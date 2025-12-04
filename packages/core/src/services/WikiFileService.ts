import { Inject, InPageEdit, Service } from '@/InPageEdit.js'
import { IWikiTitle, WatchlistAction } from '@/models/index.js'
import { WikiFileRepo } from '@/types/WikiMetadata.js'

declare module '@/InPageEdit.js' {
  interface InPageEdit {
    wikiFile: WikiFileService
  }
}

/**
 * @see https://www.mediawiki.org/wiki/API:Upload
 */
export interface UploadFileParams {
  file: File
  filekey: string
  url: string
  filename: string
  comment: string
  text: string
  tags: string[] | string
  watchlist: WatchlistAction
  ignorewarnings: boolean
  filesize: number
  offset: number
  chunk: File
  stash: boolean
  checkstatus: boolean
}

export type UploadFileResult =
  | {
      result: 'Success'
      filename: string
      imageinfo: WikiImageInfo
    }
  | {
      result: 'Failure' | 'Warning' | 'Continue' | 'Poll'
      filekey: string
      sessionkey?: string
      warnings?: {
        /** file with this filekey already exists */
        exists?: string
        /** uploaded file is the same as stored file with this timestamp */
        nochange?: { timestamp: string }
        /** uploaded file is duplicated with these files */
        duplicate?: string[]
      }
      imageinfo: never
    }

export interface WikiImageInfo {
  timestamp: string
  user: string
  userid: number
  size: number
  width: number
  height: number
  duration: number
  parsedcomment: string
  comment: string
  html: string
  canonicaltitle: string
  url: string
  descriptionurl: string
  sha1: string
  metadata: { name: string; value: any }[]
  commonmetadata: unknown[]
  extmetadata: unknown
  mime: string
  mediatype: string
  bitdepth: number
}

@Inject(['wiki', 'wikiTitle', 'wikiPage', 'apiService'])
export class WikiFileService extends Service {
  constructor(public ctx: InPageEdit) {
    super(ctx, 'wikiFile', true)
  }

  get fileRepos() {
    return this.ctx.wiki.fileRepos || []
  }
  get defaultFileRepo(): WikiFileRepo | undefined {
    return this.fileRepos[0]
  }
  get localFileRepo(): WikiFileRepo | undefined {
    return this.fileRepos.find((repo) => repo.local)
  }
  get writableFileRepo(): WikiFileRepo | undefined {
    return this.fileRepos.find((repo) => repo.canUpload)
  }

  getFileName(title: string | IWikiTitle) {
    title = this.ctx.wikiTitle.newTitle(title, 6)
    // NS_FILE, NS_MEDIA
    if (![6, -2].includes(title.getNamespaceId())) {
      throw new Error('Not a file title')
    }
    return title.getMainDBKey().split('/').pop() || ''
  }
  getHashPath(title: string | IWikiTitle, hashLevel = 2) {
    const fileName = this.getFileName(title)
    const fileNameHash = toHex(md5(fileName))
    let path = []
    for (let i = 1; i <= hashLevel; i++) {
      path.push(fileNameHash.slice(0, i))
    }
    path.push(fileName)
    return path.join('/')
  }
  getFileUrl(title: string | IWikiTitle, repo?: WikiFileRepo) {
    repo = repo || this.defaultFileRepo
    if (!repo) {
      throw new Error('No file repository found')
    }
    const hashPath = this.getHashPath(title)
    const url = new URL(`${repo.rootUrl}/${hashPath}`, location.origin)
    return url.toString()
  }

  async upload(params: Partial<UploadFileParams>, repo?: WikiFileRepo) {
    repo = repo || this.writableFileRepo
    if (!repo?.canUpload) {
      throw new Error('No writable file repository found')
    }

    if (!params.file && !params.url && !params.chunk && !params.filekey) {
      throw new Error('At least one of "file", "url", "chunk", or "filekey" is required')
    }

    const api = this.ctx.apiService.getClientByFileRepo(repo)
    return api.postWithToken<{ upload: UploadFileResult }>(
      'csrf',
      {
        action: 'upload',
        ...params,
      },
      { fexiosOptions: { timeout: 0 } }
    )
  }
}
