import { JSX } from 'jsx-dom/jsx-runtime'
import { CompareApiResponse } from '../PluginQuickDiffCore'

export type DiffTableProps = {
  data: Partial<CompareApiResponse['compare']>
} & JSX.IntrinsicElements['table']

const formatDate = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'medium',
}).format

const DiffTableHeader = (props: {
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
  return (
    <td colSpan={2} className={classList}>
      <div className="mw-diff-title--title">{props.pagetitle || props.timestamp}</div>
      <div className="mw-diff-title--user">
        {props.username && <MwUserLinks user={props.username} target="_blank" />}
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
      <div className="mw-diff-title--navigation"></div>
    </td>
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
