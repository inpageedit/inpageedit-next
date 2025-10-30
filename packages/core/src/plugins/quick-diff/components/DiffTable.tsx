import './style.scss'
import { JSX } from 'jsx-dom/jsx-runtime'
import { CompareApiResponse } from '../index.js'
import { InPageEdit } from '@/InPageEdit.js'

export type DiffTableProps = {
  data: Partial<CompareApiResponse['compare']>
  ctx: InPageEdit
} & JSX.IntrinsicElements['table']

export enum DiffTableEvent {
  update = 'ipe:diff-table/update',
  edit = 'ipe:diff-table/edit',
}

// DOM 事件类型定义
declare global {
  interface HTMLElementEventMap {
    [DiffTableEvent.update]: CustomEvent<{
      fromrev: number
      torev: number
    }>
    [DiffTableEvent.edit]: CustomEvent<{
      revid: number
    }>
  }
}

const formatDate = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'medium',
}).format

const DiffTableHeader = (props: {
  ctx: InPageEdit
  type?: 'from' | 'to'
  pageid?: number
  pagetitle?: string
  revid?: number
  size?: number
  timestamp?: string
  username?: string
  userid?: number
  comment?: string
  parsedcomment?: string
}) => {
  let classList = ['diff-title']
  if (props.type === 'from') {
    classList.push('diff-otitle')
  } else if (props.type === 'to') {
    classList.push('diff-ntitle')
  }
  if (!props.pageid || !props.userid) {
    return (
      <td colSpan={2} className={classList}>
        <div className="mw-diff-title--title">
          {props.type === 'from' ? 'Original content' : props.type === 'to' ? 'Your content' : ''}
        </div>
      </td>
    )
  }
  const handleEditClick = (e: Event) => {
    e.preventDefault()
    e.target!.dispatchEvent(
      new CustomEvent(DiffTableEvent.edit, {
        detail: { revid: props.revid! },
        bubbles: true,
      })
    )
  }
  return (
    <td colSpan={2} className={classList}>
      <div className="mw-diff-title--title">
        {props.pagetitle || props.timestamp}
        {props.revid ? ` (rev#${props.revid})` : ''}
      </div>
      <div className="mw-diff-title--actions">
        <a
          href={props.ctx.getUrl('', { action: 'edit', oldid: props.revid! })}
          onClick={handleEditClick}
        >
          <IconQuickEdit style="width: 1em; height: 1em" />
          Quick edit
        </a>
      </div>
      <div className="mw-diff-title--user">
        {props.username && <MwUserLinks ctx={props.ctx} user={props.username} target="_blank" />}
      </div>
      <div className="mw-diff-title--timestamp">
        {props.timestamp && formatDate(new Date(props.timestamp))}
      </div>
      <div className="mw-diff-title--comment">
        {props.parsedcomment && (
          <>
            (<i innerHTML={props.parsedcomment}></i>)
          </>
        )}
      </div>
    </td>
  )
}

const DiffTableNavigation = (props: { data: DiffTableProps['data']; ctx: InPageEdit }) => {
  const data = props.data
  if (!data.prev && !data.next) {
    return null
  }

  // 统一的事件处理器
  const handleNavigationClick = (e: Event, fromrev: number, torev: number) => {
    e.preventDefault()
    e.target!.dispatchEvent(
      new CustomEvent(DiffTableEvent.update, {
        detail: { fromrev, torev },
        bubbles: true,
      })
    )
  }

  return (
    <tr className="mw-diff-title--navigation">
      <td colSpan={2}>
        {data.prev ? (
          <a
            href={props.ctx.getUrl('', { diff: data.prev!, oldid: data.fromrevid! })}
            onClick={(e) => handleNavigationClick(e, data.prev!, data.fromrevid!)}
          >
            ← Previous
          </a>
        ) : (
          <i>Oldest version</i>
        )}
      </td>
      <td colSpan={2}>
        {data.next ? (
          <a
            href={props.ctx.getUrl('', { diff: data.next!, oldid: data.torevid! })}
            onClick={(e) => handleNavigationClick(e, data.torevid!, data.next!)}
          >
            Next →
          </a>
        ) : (
          <i>Newest version</i>
        )}
      </td>
    </tr>
  )
}

export const DiffTable = (props: DiffTableProps) => {
  const { data, ...rest } = props
  const table = (
    <table className={`theme-ipe diff diff-type-table`} data-mw="interface" {...rest}>
      <colgroup>
        <col className="diff-marker" />
        <col className="diff-content" />
        <col className="diff-marker" />
        <col className="diff-content" />
      </colgroup>
      <tbody>
        <tr>
          <DiffTableHeader
            ctx={props.ctx}
            type="from"
            pageid={data.fromid}
            pagetitle={data.fromtitle}
            revid={data.fromrevid}
            size={data.fromsize}
            timestamp={data.fromtimestamp}
            username={data.fromuser}
            userid={data.fromuserid}
            comment={data.fromcomment}
            parsedcomment={data.fromparsedcomment}
          />
          <DiffTableHeader
            ctx={props.ctx}
            type="to"
            pageid={data.toid}
            pagetitle={data.totitle}
            revid={data.torevid}
            size={data.tosize}
            timestamp={data.totimestamp}
            username={data.touser}
            userid={data.touserid}
            comment={data.tocomment}
            parsedcomment={data.toparsedcomment}
          />
        </tr>
        <DiffTableNavigation data={data} ctx={props.ctx} />
        <div id="diffbody"></div>
        <tr className="diff-size" style={{ textAlign: 'center' }}>
          <td colSpan={2} className="diff-size-old">
            {data.fromsize !== undefined && `${data.fromsize} bytes`}
          </td>
          <td colSpan={2} className="diff-size-new">
            {data.tosize !== undefined && `${data.tosize} bytes`}
          </td>
        </tr>
      </tbody>
    </table>
  )
  table.querySelector('#diffbody')!.outerHTML =
    data.body ||
    (
      <tr>
        <td colSpan={4}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '5rem',
            }}
          >
            <i>No changes</i>
          </div>
        </td>
      </tr>
    ).outerHTML
  return table
}
