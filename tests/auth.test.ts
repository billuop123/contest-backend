import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import app from '../index'
import { prisma } from '../utils/prismaClient'

describe('Auth Routes', () => {
  let testUserEmail: string
  let testUserId: string

  beforeEach(() => {
    testUserEmail = `testuser${Math.floor(Math.random() * 10000)}@gmail.com`
  })

  afterEach(async () => {

    await prisma.user.deleteMany({
      where: { email: testUserEmail }
    })
  })

  describe('POST /users/signup', () => {
    it('should signup a new user successfully', async () => {
      const res = await request(app)
        .post('/users/signup')
        .send({
          email: testUserEmail,
          password: 'testpassword',
          confirmPassword: 'testpassword'
        })

      expect(res.statusCode).toBe(200)
      expect(res.body.message).toBe('The user is successfully signedup')

      const user = await prisma.user.findUnique({ where: { email: testUserEmail } })
      testUserId = user?.id || ''
    })

    it('should fail if passwords do not match', async () => {
      const res = await request(app)
        .post('/users/signup')
        .send({
          email: testUserEmail,
          password: 'testpassword',
          confirmPassword: 'differentpassword'
        })

      expect(res.statusCode).toBe(403)
      expect(res.body.message).toBe('passwords donot match')
    })

    it('should fail with invalid email', async () => {
      const res = await request(app)
        .post('/users/signup')
        .send({
          email: 'invalidemail',
          password: 'testpassword',
          confirmPassword: 'testpassword'
        })

      expect(res.statusCode).toBe(403)
      expect(res.body.message).toBe('incorrect inputs')
    })

    it('should fail if user already exists', async () => {
      await request(app)
        .post('/users/signup')
        .send({
          email: testUserEmail,
          password: 'testpassword',
          confirmPassword: 'testpassword'
        })

      const res = await request(app)
        .post('/users/signup')
        .send({
          email: testUserEmail,
          password: 'testpassword',
          confirmPassword: 'testpassword'
        })

      expect(res.statusCode).toBe(200) 
      expect(res.body.message).toBe('User already exists')
    })
  })

  describe('POST /users/signin', () => {
    beforeEach(async () => {

      await request(app)
        .post('/users/signup')
        .send({
          email: testUserEmail,
          password: 'testpassword',
          confirmPassword: 'testpassword'
        })
    })

    it('should signin successfully with correct credentials', async () => {
      const res = await request(app)
        .post('/users/signin')
        .send({
          email: testUserEmail,
          password: 'testpassword'
        })

      expect(res.statusCode).toBe(200)
      expect(res.body.message).toBe('User successfully signed in')
      expect(res.body.token).toBeDefined()
    })

    it('should fail with incorrect password', async () => {
      const res = await request(app)
        .post('/users/signin')
        .send({
          email: testUserEmail,
          password: 'wrongpassword'
        })

      expect(res.statusCode).toBe(404)
      expect(res.body.message).toBe('The user and password donot match')
    })

    it('should fail with non-existing user', async () => {
      const res = await request(app)
        .post('/users/signin')
        .send({
          email: 'nonexisting@gmail.com',
          password: 'testpassword'
        })

      expect(res.statusCode).toBe(404)
      expect(res.body.message).toBe('The user and password donot match')
    })

    it('should fail with invalid email format', async () => {
      const res = await request(app)
        .post('/users/signin')
        .send({
          email: 'invalidemail',
          password: 'testpassword'
        })

      expect(res.statusCode).toBe(403)
      expect(res.body.message).toBe('The input fields are not valid')
    })
  })

  describe('POST /users/verify', () => {
    beforeEach(async () => {

      await request(app)
        .post('/users/signup')
        .send({
          email: testUserEmail,
          password: 'testpassword',
          confirmPassword: 'testpassword'
        })

      const user = await prisma.user.findUnique({ where: { email: testUserEmail } })
      testUserId = user?.id || ''
    })

    it('should verify user successfully', async () => {
      const user = await prisma.user.findUnique({ where: { id: testUserId } })
      const hashedToken = user?.hashedToken

      const res = await request(app)
        .post('/users/verify')
        .query({ hashedToken })
        .send({ userId: testUserId })

      expect(res.statusCode).toBe(200)
      expect(res.body.message).toBe('User is successfully verified')
    })

    it('should fail with missing hashedToken', async () => {
      const res = await request(app)
        .post('/users/verify')
        .send({ userId: testUserId })

      expect(res.statusCode).toBe(404)
      expect(res.body.message).toBe('required fields are not found')
    })

    it('should fail with invalid hashedToken', async () => {
      const res = await request(app)
        .post('/users/verify')
        .query({ hashedToken: 'invalidtoken' })
        .send({ userId: testUserId })

      expect(res.statusCode).toBe(404)
      expect(res.body.message).toBe('Unverified user is not found')
    })

    it('should fail if user is already verified', async () => {
      const user = await prisma.user.findUnique({ where: { id: testUserId } })
      const hashedToken = user?.hashedToken

      await request(app)
        .post('/users/verify')
        .query({ hashedToken })
        .send({ userId: testUserId })

      // Try to verify again
      const res = await request(app)
        .post('/users/verify')
        .query({ hashedToken })
        .send({ userId: testUserId })   

      expect(res.statusCode).toBe(404)
      expect(res.body.message).toBe('The unverified user is not found')
    })
  })
})