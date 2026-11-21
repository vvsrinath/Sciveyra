/** Shared public identity. Keep spelling and links identical across the app. */
export const DEVELOPER_NAME = 'Srinath Vatchavari Venkateshan'
export const COPYRIGHT_OWNER = 'Srinath Vatchavari Venkateshan'

export const CONTACT = {
  linkedin: 'https://www.linkedin.com/in/srinath-v-a26b372b7/',
  githubUser: 'vvsrinath',
  github: 'https://github.com/vvsrinath',
  email: 'vvsrinath0@gmail.com'
}

export function copyrightLine(year = new Date().getFullYear()) {
  return `© ${year} ${COPYRIGHT_OWNER}. All rights reserved.`
}
