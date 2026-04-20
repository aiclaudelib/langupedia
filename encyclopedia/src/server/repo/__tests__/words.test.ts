import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { setupDb } from './setupDb'
import { createProject } from '../projects'
import { upsertWord } from '../words'

describe('upsertWord validation', () => {
  let db: Database.Database

  beforeEach(() => {
    db = setupDb()
    createProject(db, { id: 'p1', name: 'p1' })
  })

  afterEach(() => {
    db.close()
  })

  it('throws when forms is an object (must be string or null)', () => {
    expect(() =>
      upsertWord(db, {
        projectId: 'p1',
        lang: 'en',
        word: { word: 'bad', forms: { base: 'bad' } as unknown as string },
      }),
    ).toThrow(/forms must be string or null/)
  })

  it('accepts forms as a string', () => {
    expect(() =>
      upsertWord(db, { projectId: 'p1', lang: 'en', word: { word: 'ok', forms: 'ok, okay' } }),
    ).not.toThrow()
  })

  it('accepts forms as null', () => {
    expect(() =>
      upsertWord(db, { projectId: 'p1', lang: 'en', word: { word: 'ok', forms: null } }),
    ).not.toThrow()
  })

  it('throws when word.word is missing', () => {
    expect(() =>
      upsertWord(db, { projectId: 'p1', lang: 'en', word: { word: '' } }),
    ).toThrow(/word\.word is required/)
  })
})
