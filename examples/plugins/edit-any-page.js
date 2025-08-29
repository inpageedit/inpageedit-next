/**
 * @typedef {import('../../src').InPageEdit} InPageEdit
 */

mw.hook('InPageEdit.ready').add(
  /** @param {InPageEdit} ipe */
  (ipe) => {
    ipe.plugin({
      name: 'Edit Any Page',
      inject: ['toolbox', 'quickEdit', 'modal'],
      apply(ctx) {
        const PencilBolt = () => {
          const i = document.createElement('i')
          i.classList.add('x-icon')
          i.innerHTML = `<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-pencil-bolt"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" /><path d="M19 16l-2 3h4l-2 3" /></svg>`
          return i
        }
        ctx.toolbox.addButton({
          id: 'edit-any-page',
          icon: PencilBolt(),
          tooltip: 'Edit any page',
          onClick: () => {
            const form = document.createElement('form')
            const input = document.createElement('input')
            input.type = 'text'
            input.placeholder = 'Enter page name'
            input.value = mw.config.get('wgPageName')
            input.style.width = '100%'
            form.appendChild(input)
            ctx.modal.confirm(
              {
                title: 'Edit any page',
                content: form,
                center: true,
                className: 'in-page-edit',
                okBtn: {
                  className: 'btn',
                },
                cancelBtn: {
                  className: 'btn',
                },
              },
              (result) => {
                if (!result) return true
                const pageName = input.value.trim()
                if (!pageName) return false
                ctx.quickEdit({
                  title: pageName,
                })
                return true
              }
            )
          },
        })
      },
    })
  }
)
