import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import  app  from '../index'
import { prisma } from '../utils/prismaClient'

describe('Admin Routes', () => {
  let testContestId: string
  let testChallengeId: string
  let adminToken: string
  let adminEmail: string

  beforeEach(async () => {
    // Create admin user
    adminEmail = `admintest${Math.floor(Math.random() * 10000)}@gmail.com`
    const adminUsername = `admintest${Math.floor(Math.random() * 10000)}`

    // Clean up any existing user with this email
    await prisma.user.deleteMany({ where: { email: adminEmail } })

    await request(app)
      .post('/users/signup')
      .send({
        username: adminUsername,
        email: adminEmail,
        password: 'adminpassword',
        confirmPassword: 'adminpassword'
      })

    // Make user admin in database
    // Wait a bit for user creation to complete
    await new Promise(resolve => setTimeout(resolve, 500))
    const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } })
    if (adminUser) {
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { role: 'admin' }
      })
    }

    const signinRes = await request(app)
      .post('/users/signin')
      .send({
        email: adminEmail,
        password: 'adminpassword'
      })

    adminToken = signinRes.body.token
  })

  afterEach(async () => {
    // Clean up test data
    if (testChallengeId) {
      await prisma.contestToChallengeMapping.deleteMany({
        where: { challengeId: testChallengeId }
      })
      await prisma.challenge.deleteMany({
        where: { id: testChallengeId }
      })
      testChallengeId = ''
    }
    if (testContestId) {
      await prisma.contest.deleteMany({
        where: { id: testContestId }
      })
      testContestId = ''
    }
    if (adminEmail) {
      await prisma.user.deleteMany({
        where: { email: adminEmail }
      })
      adminEmail = ''
    }
  })

  describe('POST /admin/createcontest', () => {
    it('should create a contest successfully', async () => {
      const startTime = new Date(Date.now() + 1000 * 60 * 60) // 1 hour from now
      const endTime = new Date(Date.now() + 1000 * 60 * 60 * 24) // 24 hours from now

      const res = await request(app)
        .post('/admin/createcontest')
        .set('Authorization', adminToken)
        .send({
          title: 'Test Contest',
          startTime,
          endTime
        })

      expect(res.statusCode).toBe(200)
      expect(res.body.message).toBe('Contest successfully created')
      expect(res.body.contest).toBeDefined()
      expect(res.body.contest.title).toBe('Test Contest')

      testContestId = res.body.contest.id
    })

    it('should fail with invalid inputs', async () => {
      const res = await request(app)
        .post('/admin/createcontest')
        .set('Authorization', adminToken)
        .send({
          title: '',
          startTime: 'invalid',
          endTime: 'invalid'
        })

      expect(res.statusCode).toBe(403)
      expect(res.body.message).toBe('The inputs are not valid')
    })

    it('should fail with missing fields', async () => {
      const res = await request(app)
        .post('/admin/createcontest')
        .set('Authorization', adminToken)
        .send({
          title: 'Test Contest'
          // missing startTime and endTime
        })

      expect(res.statusCode).toBe(403)
      expect(res.body.message).toBe('The inputs are not valid')
    })
  })

  describe('POST /admin/createchallenge', () => {
    beforeEach(async () => {
      // Create a test contest
      const startTime = new Date(Date.now() + 1000 * 60 * 60) // 1 hour from now
      const endTime = new Date(Date.now() + 1000 * 60 * 60 * 24) // 24 hours from now

      const res = await request(app)
        .post('/admin/createcontest')
        .set('Authorization', adminToken)
        .send({
          title: 'Test Contest for Challenge',
          startTime,
          endTime
        })

      testContestId = res.body.contest.id
    })

    it('should create a challenge successfully', async () => {
      const res = await request(app)
        .post('/admin/createchallenge')
        .set('Authorization', adminToken)
        .send({
          notionDocId: 'test-doc-id',
          title: 'Test Challenge',
          maxPoints: 100,
          index: 1,
          contestId: testContestId,
          body: 'Test challenge body',
          examples: 'Test examples'
        })

      expect(res.statusCode).toBe(200)
      expect(res.body.message).toBe('The challange is successfully created')
      expect(res.body.contestId).toBe(testContestId)
      expect(res.body.challengeId).toBeDefined()

      testChallengeId = res.body.challengeId
    })

    it('should fail with missing required fields', async () => {
      const res = await request(app)
        .post('/admin/createchallenge')
        .set('Authorization', adminToken)
        .send({
          title: 'Test Challenge',
          maxPoints: 100,
          contestId: testContestId
          // missing other fields
        })

      expect(res.statusCode).toBe(404)
      expect(res.body.message).toBe('The required input fields are missing')
    })

    it('should fail if contest deadline is over', async () => {
      // Create a contest with past endTime
      const pastEndTime = new Date(Date.now() - 1000 * 60 * 60) // 1 hour ago
      const contestRes = await request(app)
        .post('/admin/createcontest')
        .set('Authorization', adminToken)
        .send({
          title: 'Past Contest',
          startTime: new Date(Date.now() - 1000 * 60 * 60 * 24),
          endTime: pastEndTime
        })

      const pastContestId = contestRes.body.contest.id

      const res = await request(app)
        .post('/admin/createchallenge')
        .set('Authorization', adminToken)
        .send({
          notionDocId: 'test-doc-id',
          title: 'Test Challenge',
          maxPoints: 100,
          index: 1,
          contestId: pastContestId,
          body: 'Test challenge body',
          examples: 'Test examples'
        })

      expect(res.statusCode).toBe(403)
      expect(res.body.message).toBe('Deadline is over')

      // Clean up
      await prisma.contest.deleteMany({
        where: { id: pastContestId }
      })
    })
  })
})