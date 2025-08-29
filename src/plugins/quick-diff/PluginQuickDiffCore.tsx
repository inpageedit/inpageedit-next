import { InPageEdit } from '@/InPageEdit'
import { type QuickEditInitPayload } from '@/plugins/quick-edit'
import { JsDiffDiffType } from './JsDiffService'

import styles from './styles.module.sass'
import { ChangeObject } from 'diff'

declare module '@/InPageEdit' {
  interface InPageEdit {
    quickDiff: PluginQuickDiffCore
  }
}

export class PluginQuickDiffCore extends BasePlugin {
  static readonly inject = ['JsDiff']
  VALID_DIFF_TYPES: JsDiffDiffType[] = [
    'diffChars',
    'diffWords',
    'diffSentences',
    'diffLines',
    'createTwoFilesPatch',
  ]

  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'quick-diff')
  }

  protected start(): Promise<void> | void {
    this.ctx.set('quickDiff', this)
    this.ctx.on('quickEdit/wikiPage', this.injectQuickEdit.bind(this))
  }

  protected stop(): Promise<void> | void {
    this.ctx.off('quickEdit/wikiPage', this.injectQuickEdit.bind(this))
  }

  private injectQuickEdit({ modal, wikiPage }: QuickEditInitPayload) {
    modal.setButtons([
      {
        label: 'Diff',
        side: 'left',
        className: 'btn btn-secondary',
        method: () => {
          const oldStr = wikiPage.revisions?.[0]?.content || ''
          const newStr = (modal.get$content().find('textarea.editArea').val() as string) || ''
          this.simpleTextDiff(oldStr, newStr)
        },
      },
    ])
  }

  simpleTextDiff(oldText: string, newText: string) {
    const modal = this.ctx.modal.show({
      title: 'Quick Diff',
      className: 'in-page-edit ipe-quickDiff',
    })
    modal.show()

    const container = <pre className={styles['diff-container']}></pre>
    const controller = (
      <div
        style={{
          display: 'flex',
          gap: '1em',
        }}
      >
        {this.VALID_DIFF_TYPES.map((type, index) => (
          <RadioBox
            name="diffType"
            value={type}
            label={type}
            inputProps={{
              checked: index === 0,
            }}
          />
        ))}
        <input type="radio" checked />
      </div>
    )
    modal.setContent(
      (
        <section>
          {controller}
          {container}
        </section>
      ) as HTMLElement
    )
    controller.querySelectorAll<HTMLInputElement>('input[name="diffType"]').forEach((input) => {
      input.addEventListener('change', () => {
        const diff = this.renderJsDiff(oldText, newText, input.value as JsDiffDiffType)
        container.textContent = ''
        container.appendChild(diff)
      })
    })
    controller
      .querySelector<HTMLInputElement>('input[name="diffType"]')!
      .dispatchEvent(new Event('change'))
  }

  /**
   * TODO: 类型体操
   */
  renderJsDiff(oldStr: string, newStr: string, diffType: JsDiffDiffType = 'diffSentences') {
    const fragment = document.createDocumentFragment()

    let diff: (ChangeObject<string> & { chunkHeader?: boolean })[]
    if (diffType === 'createTwoFilesPatch') {
      // 将 patch 结果转化为与 diffChars/diffWords... 类似的结构
      let pastHunkHeader = false
      diff = this.ctx.JsDiff.createTwoFilesPatch('original.txt', 'modified.txt', oldStr, newStr)
        .split('\n')
        .map(function (entry) {
          const line = {
            value: entry + '\n',
          } as ChangeObject<string> & { chunkHeader: boolean }
          if (entry.startsWith('@@')) {
            line.chunkHeader = true
            pastHunkHeader = true
          } else if (pastHunkHeader) {
            if (entry.startsWith('-')) {
              line.removed = true
            } else if (entry.startsWith('+')) {
              line.added = true
            }
          }
          return line
        })
    } else {
      const handler = this.ctx.JsDiff[diffType] as (
        oldStr: string,
        newStr: string
      ) => ChangeObject<string>[]
      if (!handler) {
        throw new Error(`Missing DiffEngine for ${diffType}`)
      }
      diff = handler(oldStr, newStr)
    }

    if (!Array.isArray(diff)) {
      throw new Error('Missing diff result')
    }

    // 交换逻辑（一个删除一个新增时）
    for (let i = 0; i < diff.length; i++) {
      if (diff[i].added && diff[i + 1] && diff[i + 1].removed) {
        const swap = diff[i]
        diff[i] = diff[i + 1]
        diff[i + 1] = swap
      }

      let node
      if (diff[i].removed) {
        node = document.createElement('del')
        node.appendChild(document.createTextNode(diff[i].value))
      } else if (diff[i].added) {
        node = document.createElement('ins')
        node.appendChild(document.createTextNode(diff[i].value))
      } else if (diff[i].chunkHeader) {
        node = document.createElement('span')
        node.setAttribute('class', 'chunk-header')
        node.appendChild(document.createTextNode(diff[i].value))
      } else {
        node = document.createTextNode(diff[i].value)
      }
      fragment.appendChild(node)
    }

    return fragment
  }

  //
  compare() {}
}
