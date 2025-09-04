import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import app from '../index'
import { prisma } from '../utils/prismaClient'

describe('User Routes', () => {
  let userToken: string
  let testUserEmail: string
  let testUserId: string
  let contestId: string
  let challengeId: string
  let mappingId: string

  beforeEach(async () => {

    testUserEmail = `testuser${Math.floor(Math.random() * 10000)}@gmail.com`
    await request(app)
      .post('/users/signup')
      .send({
        email: testUserEmail,
        password: 'testpassword',
        confirmPassword: 'testpassword'
      })

    const signinRes = await request(app)
      .post('/users/signin')
      .send({
        email: testUserEmail,
        password: 'testpassword'
      })

    userToken = signinRes.body.token

    const user = await prisma.user.findUnique({ where: { email: testUserEmail } })
    testUserId = user?.id || ''


    const startTime = new Date(Date.now() - 1000 * 60 * 30) 
    const endTime = new Date(Date.now() + 1000 * 60 * 60 * 2) 
    const contestRes = await request(app)
      .post('/admin/createcontest')
      .send({
        title: 'Test Contest for Submissions',
        startTime,
        endTime
      })
    contestId = contestRes.body.contest.id


    const challengeRes = await request(app)
      .post('/admin/createchallenge')
      .send({
        notionDocId: 'test-doc-id',
        title: 'Test Challenge',
        maxPoints: 100,
        index: 1,
        contestId,
        body: 'Test challenge body',
        examples: 'Test examples'
      })
    challengeId = challengeRes.body.challengeId


    const mapping = await prisma.contestToChallengeMapping.findFirst({
      where: { contestId, challengeId }
    })
    mappingId = mapping?.id || ''
  })

  afterEach(async () => {

    await prisma.submission.deleteMany({
      where: { userId: testUserId }
    })
    await prisma.leaderboard.deleteMany({
      where: { userId: testUserId }
    })
    await prisma.contestToChallengeMapping.deleteMany({
      where: { contestId }
    })
    await prisma.challenge.deleteMany({
      where: { id: challengeId }
    })
    await prisma.contest.deleteMany({
      where: { id: contestId }
    })
    await prisma.user.deleteMany({
      where: { email: testUserEmail }
    })
  })

  describe('POST /users/submissions', () => {
    it('should submit code successfully', async () => {
      const res = await request(app)
        .post('/users/submissions')
        .set('Authorization', userToken)
        .send({
          submissions: 'console.log("Hello World");',
          contestToChallengeMappingId: mappingId
        })

        expect(res.body.message).toBe('Submitted successfully')
        expect(res.statusCode).toBe(200)
      expect(res.body.points).toBeDefined()
      expect(res.body.feedback).toBeDefined()
    },15000)

    it('should fail without authentication', async () => {
      const res = await request(app)
        .post('/users/submissions')
        .send({
          submissions: 'console.log("Hello World");',
          contestToChallengeMappingId: mappingId
        })

      expect(res.statusCode).toBe(401)
      expect(res.body.message).toBe('No token found')
    })

    it('should fail with invalid contest mapping', async () => {
      const res = await request(app)
        .post('/users/submissions')
        .set('Authorization', userToken)
        .send({
          submissions: 'console.log("Hello World");',
          contestToChallengeMappingId: 'invalid-id'
        })

      expect(res.statusCode).toBe(404)
      expect(res.body.message).toBe('Invalid contest mapping')
    })

    it('should fail if contest deadline is over', async () => {
      // Create active contest first
      const activeStart = new Date(Date.now() - 1000 * 60 * 30) // 30 min ago
      const activeEnd = new Date(Date.now() + 1000 * 60 * 60 * 2) // 2 hours from now
      const contestRes = await request(app)
        .post('/admin/createcontest')
        .send({
          title: 'Deadline Test Contest',
          startTime: activeStart,
          endTime: activeEnd
        })
      const contestId = contestRes.body.contest.id
      expect(contestId).toBeDefined()

      // Create challenge for active contest
      const challengeRes = await request(app)
        .post('/admin/createchallenge')
        .send({
          notionDocId: 'test-doc-id',
          title: 'Deadline Test Challenge',
          maxPoints: 100,
          index: 1,
          contestId,
          body: 'Test challenge body',
          examples: 'Test examples'
        })
      const challengeId = challengeRes.body.challengeId
      expect(challengeId).toBeDefined()

      const mapping = await prisma.contestToChallengeMapping.findFirst({
        where: { contestId, challengeId }
      })
      const mappingId = mapping?.id
      expect(mappingId).toBeDefined()

      // Update contest endTime to past in database
      await prisma.contest.update({
        where: { id: contestId },
        data: { endTime: new Date(Date.now() - 1000 * 60 * 60) } // 1 hour ago
      })

      const res = await request(app)
        .post('/users/submissions')
        .set('Authorization', userToken)
        .send({
          submissions: 'console.log("Hello World");',
          contestToChallengeMappingId: mappingId
        })

      expect(res.statusCode).toBe(403)
      expect(res.body.message).toBe('The deadline for the following contest is already over')

      // Clean up
      await prisma.contestToChallengeMapping.deleteMany({
        where: { contestId }
      })
      await prisma.challenge.deleteMany({
        where: { id: challengeId }
      })
      await prisma.contest.deleteMany({
        where: { id: contestId }
      })
    })
  })
})