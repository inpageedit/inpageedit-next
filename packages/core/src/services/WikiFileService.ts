import { Inject, InPageEdit, Service } from '@/InPageEdit.js'
import { IWikiTitle, WatchlistAction } from '@/models/index.js'
import { WikiFileRepo } from '@/types/WikiMetadata.js'

declare module '@/InPageEdit.js' {
  interface InPageEdit {
    wikiFile: WikiFileService
  }
}

@Inject(['wiki', 'wikiTitle', 'wikiPage'])
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

  async uploadFile(
    title: string | IWikiTitle,
    file: File,
    params?: {
      comment?: string
      text?: string
      tags?: string[] | string
      watchlist?: WatchlistAction
      ignorewarnings?: boolean
    },
    repo?: WikiFileRepo
  ) {
    repo = repo || this.writableFileRepo
    title = this.ctx.wikiTitle.newTitle(title, 6)
    if (!repo?.canUpload) {
      throw new Error('No writable file repository found')
    }
    const api = this.ctx.apiService.getClientByFileRepo(repo)
    return api.postWithToken('csrf', {
      action: 'upload',
      file,
      filename: title.getMainDBKey(),
      ...params,
    })
  }
}
