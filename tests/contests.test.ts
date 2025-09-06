import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import app from '../index'
import { prisma } from '../utils/prismaClient'

describe('Contest Routes', () => {
  let userToken: string
  let testUserEmail: string
  let activeContestId: string
  let inactiveContestId: string
  let adminToken: string
  let adminEmail: string

  beforeEach(async () => {
    // Create admin user
    adminEmail = `admintest${Math.floor(Math.random() * 10000)}@gmail.com`
    const adminUsername = `admintest${Math.floor(Math.random() * 10000)}`

    // Clean up any existing user with this email
    await prisma.user.deleteMany({ where: { email: adminEmail } })

    const signupRes = await request(app)
      .post('/users/signup')
      .send({
        username: adminUsername,
        email: adminEmail,
        password: 'adminpassword',
        confirmPassword: 'adminpassword'
      })

    if (signupRes.status !== 200) {
      console.log('Signup failed:', signupRes.status, signupRes.body)
    }

    // Wait a bit for user creation to complete
    await new Promise(resolve => setTimeout(resolve, 500))
    const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } })
    if (adminUser) {
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { role: 'admin' }
      })
    } else {
      console.log('Admin user not found after signup')
    }

    const adminSigninRes = await request(app)
      .post('/users/signin')
      .send({
        email: adminEmail,
        password: 'adminpassword'
      })

    adminToken = adminSigninRes.body.token

    // Create test user
    testUserEmail = `testuser${Math.floor(Math.random() * 10000)}@gmail.com`
    const testUsername = `testuser${Math.floor(Math.random() * 10000)}`
    await request(app)
      .post('/users/signup')
      .send({
        username: testUsername,
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

    // Create active contest
    const activeStart = new Date(Date.now() - 1000 * 60 * 30) // 30 min ago
    const activeEnd = new Date(Date.now() + 1000 * 60 * 60 * 2) // 2 hours from now
    const activeRes = await request(app)
      .post('/admin/createcontest')
      .set('Authorization', adminToken)
      .send({
        title: 'Active Test Contest',
        startTime: activeStart,
        endTime: activeEnd
      })
    activeContestId = activeRes.body.contest.id

    // Create inactive contest
    const inactiveStart = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2) // 2 days ago
    const inactiveEnd = new Date(Date.now() - 1000 * 60 * 60) // 1 hour ago
    const inactiveRes = await request(app)
      .post('/admin/createcontest')
      .set('Authorization', adminToken)
      .send({
        title: 'Inactive Test Contest',
        startTime: inactiveStart,
        endTime: inactiveEnd
      })
    inactiveContestId = inactiveRes.body.contest.id
  })

  afterEach(async () => {
    // Clean up
    await prisma.contest.deleteMany({
      where: { id: { in: [activeContestId, inactiveContestId] } }
    })
    await prisma.user.deleteMany({
      where: { email: testUserEmail }
    })
    if (adminEmail) {
      await prisma.user.deleteMany({
        where: { email: adminEmail }
      })
    }
  })

  describe('GET /contest/active', () => {
    it('should return active contests', async () => {
      const res = await request(app)
        .get('/contest/active')
        .set('Authorization', userToken)

      expect(res.statusCode).toBe(200)
      expect(res.body.contests).toBeDefined()
      expect(Array.isArray(res.body.contests)).toBe(true)
      expect(res.body.page).toBe(1)
      expect(res.body.limit).toBe(10)
      expect(res.body.total).toBeGreaterThanOrEqual(1)
    })

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/contest/active')

      expect(res.statusCode).toBe(401)
      expect(res.body.message).toBe('No token found')
    })
  })

  describe('GET /contest/inactive', () => {
    it('should return inactive contests', async () => {
      const res = await request(app)
        .get('/contest/inactive')
        .set('Authorization', userToken)

      expect(res.statusCode).toBe(200)
      expect(res.body.contests).toBeDefined()
      expect(Array.isArray(res.body.contests)).toBe(true)
      expect(res.body.page).toBe(1)
      expect(res.body.limit).toBe(10)
      expect(res.body.total).toBeGreaterThanOrEqual(1)
    })
  })

  describe('GET /contest/getcontests/:contestId', () => {
    it('should return contest details', async () => {
      const res = await request(app)
        .get(`/contest/getcontests/${activeContestId}`)
        .set('Authorization', userToken)

      expect(res.statusCode).toBe(200)
      expect(res.body.contest).toBeDefined()
      expect(res.body.contest.id).toBe(activeContestId)
      expect(res.body.contest.title).toBe('Active Test Contest')
    })

    it('should fail with invalid contestId', async () => {
      const res = await request(app)
        .get('/contest/getcontests/invalid-id')
        .set('Authorization', userToken)

      expect(res.statusCode).toBe(404)
      expect(res.body.message).toBe('there is no record of specific input')
    })
  })

  describe('GET /contest/leaderboard/:contestId', () => {
    it('should return leaderboard', async () => {
      const res = await request(app)
        .get(`/contest/leaderboard/${activeContestId}`)
        .set('Authorization', userToken)

      expect(res.statusCode).toBe(200)
      expect(res.body.topUsers).toBeDefined()
      expect(Array.isArray(res.body.topUsers)).toBe(true)
    })

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get(`/contest/leaderboard/${activeContestId}`)

      expect(res.statusCode).toBe(401)
      expect(res.body.message).toBe('No token found')
    })

    it('should fail with invalid contestId', async () => {
      const res = await request(app)
        .get('/contest/leaderboard/invalid-id')
        .set('Authorization', userToken)

      expect(res.statusCode).toBe(404) // Internal server error due to invalid id
    })
  })
})