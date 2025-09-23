export const MwUserLinks = (props: { user: string; target?: string }) => {
  let { user, target } = props
  const articlePath = window.mw?.config?.get('wgArticlePath') || '/$1'
  const getUrl = (title: string) => {
    return articlePath.replace('$1', title)
  }
  return (
    <span className="mw-userlinks">
      <a href={getUrl(`User:${user}`)} className="mw-userlink" target={target}>
        {user}
      </a>{' '}
      <span className="mw-usertoollinks">
        (
        <a href={getUrl(`User_talk:${user}`)} className="mw-usertoollinks-talk" target={target}>
          talk
        </a>
        {' | '}
        <a
          href={getUrl(`Special:Contributions/${user}`)}
          className="mw-usertoollinks-contribs"
          target={target}
        >
          contribs
        </a>
        {' | '}
        <a
          href={getUrl(`Special:Block/${user}`)}
          className="mw-usertoollinks-block"
          target={target}
        >
          block
        </a>
        )
      </span>
    </span>
  )
}
