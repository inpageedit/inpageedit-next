import { InPageEdit } from '@/InPageEdit'

export class PluginQuickRename extends BasePlugin {
  static readonly inject = ['api', 'wikiPage', 'modal']

  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'quick-rename')
  }

  protected start(): Promise<void> | void {
    this.ctx.inject(['toolbox'], (ctx) => {
      this.ctx = ctx
      ctx.toolbox.addButton({
        id: 'quickMoveFrom',
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="icon icon-tabler icons-tabler-outline icon-tabler-login-2"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M9 8v-2a2 2 0 0 1 2 -2h7a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2v-2" />
            <path d="M3 12h13l-3 -3" />
            <path d="M13 15l3 -3" />
          </svg>
        ) as HTMLElement,
        tooltip: 'Make redirect to this page',
        group: 'group2',
        onClick: () => {
          this.showModal()
        },
      })
      ctx.toolbox.addButton({
        id: 'quickMoveTo',
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="icon icon-tabler icons-tabler-outline icon-tabler-logout"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" />
            <path d="M9 12h12l-3 -3" />
            <path d="M18 15l3 -3" />
          </svg>
        ) as HTMLElement,
        tooltip: 'Move this page',
        group: 'group2',
        onClick: () => {
          this.showModal()
        },
      })
      this.addDisposeHandler((ctx) => {
        ctx.toolbox.removeButton('quickMoveFrom')
        ctx.toolbox.removeButton('quickMoveTo')
      })
    })
  }

  protected stop(): Promise<void> | void {}

  showModal() {
    const modal = this.ctx.modal.show({
      title: 'Quick Rename',
      content: (<ProgressBar />) as HTMLElement,
    })
  }
}
