import { SiteInfo, SiteMetadata } from '@/types/SiteMetadata'

export class WikiTitle {
  constructor(
    title: string,
    ns: string | number,
    readonly namespaceMap: { id: number; canonical: string; aliases: string[] }
  ) {}
}
