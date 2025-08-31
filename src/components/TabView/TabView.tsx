import { ReactNode } from 'jsx-dom'
import styles from './styles.module.sass'

export interface TabViewLabelOptions {
  name: string
  children: ReactNode
}

console.log(styles)

export function TabView({
  tabs = [],
  defaultActiveIndex = 0,
}: {
  tabs: (TabViewLabelOptions & { content: ReactNode })[]
  defaultActiveIndex?: number
}) {
  const el = (
    <div className={`ipe-tabView ${styles.tabview}`}>
      <ul className={`ipe-tabView__labels-container ${styles.labels_container}`}>
        {tabs.map((tab) => (
          <TabLabel key={tab.name} name={tab.name}>
            {tab.children}
          </TabLabel>
        ))}
      </ul>
      <div className={`ipe-tabView__contents ${styles.contents_container}`}>
        {tabs.map((tab) => (
          <TabContent key={tab.name} name={tab.name}>
            {tab.content}
          </TabContent>
        ))}
      </div>
    </div>
  )

  const defaultActiveLabel = el.querySelector<HTMLAnchorElement>(
    `.ipe-tabView__labels-container > .ipe-tabView__label:nth-child(${defaultActiveIndex + 1})`
  )
  if (defaultActiveLabel) {
    defaultActiveLabel.click()
  }

  return el
}

export function TabLabel({ name, children }: { name: string; children: ReactNode }) {
  return (
    <li
      data-tab-name={name}
      className={`ipe-tabView__label ${styles.label}`}
      onClick={function (e) {
        e.preventDefault()
        const container = this.closest('.ipe-tabView')
        if (!container) return
        const labels = Array.from(container.children).find((el) =>
          el.classList.contains('ipe-tabView__labels')
        )?.children
        if (labels) {
          Array.from(labels).forEach((label) => {
            label.classList.remove(styles.active)
          })
        }
        this.classList.add(styles.active)
        const contents = Array.from(container.children).find((el) =>
          el.classList.contains('ipe-tabView__contents')
        )?.children
        if (contents) {
          Array.from(contents).forEach((content) => {
            if (content instanceof HTMLElement) {
              if (content.dataset.tabName === name) {
                content.style.display = ''
                content.classList.add(styles.active)
              } else {
                content.style.display = 'none'
                content.classList.remove(styles.active)
              }
            }
          })
        }
      }}
    >
      <a>{children || name}</a>
    </li>
  )
}

export function TabContent({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div
      data-tab-name={name}
      className="ipe-tabView__content-body"
      style={{
        display: 'none',
      }}
    >
      {children}
    </div>
  )
}
