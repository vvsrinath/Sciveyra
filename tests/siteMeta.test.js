import { describe, expect, it } from 'vitest'
import { CONTACT, COPYRIGHT_OWNER, DEVELOPER_NAME, copyrightLine } from '../src/lib/siteMeta.js'

describe('public site identity', () => {
  it('uses the confirmed developer spelling everywhere', () => {
    expect(DEVELOPER_NAME).toBe('Srinath Vatchavari Venkateshan')
    expect(COPYRIGHT_OWNER).toBe(DEVELOPER_NAME)
    expect(copyrightLine(2026)).toBe('© 2026 Srinath Vatchavari Venkateshan. All rights reserved.')
  })

  it('keeps the requested contact links exact', () => {
    expect(CONTACT.linkedin).toBe('https://www.linkedin.com/in/srinath-v-a26b372b7/')
    expect(CONTACT.githubUser).toBe('vvsrinath')
    expect(CONTACT.github).toBe('https://github.com/vvsrinath')
    expect(CONTACT.email).toBe('vvsrinath0@gmail.com')
  })
})
