/**
 * Provides the JsDiff library to InPageEdit.
 *
 * @see https://github.com/kpdecker/jsdiff
 */

import { InPageEdit } from '@/InPageEdit'
import * as JsDiff from 'diff'

declare module '@/InPageEdit' {
  interface InPageEdit {
    jsdiff: JsDiffService
  }
}

export type JsDiffDiffType =
  | 'diffChars'
  | 'diffWords'
  | 'diffWordsWithSpace'
  | 'diffLines'
  | 'diffTrimmedLines'
  | 'diffSentences'
  | 'diffCss'
  | 'diffJson'
  | 'diffArrays'
  | 'createTwoFilesPatch'

export class JsDiffService {
  constructor(public ctx: InPageEdit) {
    this.ctx.set('jsdiff', this)
  }
  JsDiff = JsDiff
  diffChars = JsDiff.diffChars
  diffWords = JsDiff.diffWords
  diffWordsWithSpace = JsDiff.diffWordsWithSpace
  diffLines = JsDiff.diffLines
  diffTrimmedLines = JsDiff.diffTrimmedLines
  diffSentences = JsDiff.diffSentences
  diffCss = JsDiff.diffCss
  diffJson = JsDiff.diffJson
  diffArrays = JsDiff.diffArrays
  createTwoFilesPatch = JsDiff.createTwoFilesPatch
}
