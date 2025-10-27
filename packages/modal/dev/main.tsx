import { IPEModal } from '../src/index.js'
import '../src/style.scss'

Object.assign(window, {
  // debug
  IPEModal,
  // simulation
  ipe: {
    modal: IPEModal,
  },
})

const App = () => (
  <div className="full">
    <h1>@inpageedit/modal</h1>
    <h2>Normal Modal</h2>
    <button
      onClick={() => {
        IPEModal.show({
          title: 'Normal Modal',
          content: (
            <div>
              {Array.from({ length: 20 }, () => (
                <p>This is a normal modal.</p>
              ))}
            </div>
          ),
          buttons: [
            {
              label: 'OK',
              side: 'left',
              className: 'is-primary',
              method(_, m) {
                m.close()
              },
            },
            {
              label: 'Close',
              className: 'is-danger is-text',
              method(_, m) {
                m.close()
              },
            },
          ],
        })
      }}
    >
      Open Modal
    </button>
    <h2>Dialog</h2>
    <button
      onClick={() => {
        IPEModal.dialog({
          title: 'Dialog',
          content: <div>This is a dialog.</div>,
        })
      }}
    >
      Open Dialog
    </button>
    <h2>Confirmation Modal</h2>
    <button
      onClick={() => {
        IPEModal.confirm(
          {
            title: 'Confirmation Modal',
            content: <div>Are you sure you want to proceed?</div>,
          },
          (selection) => {
            alert(`You selected: ${selection}`)
          }
        )
      }}
    >
      Show Confirm
    </button>
    <h2>Toast</h2>
    <button
      onClick={() => {
        ;['', 'success', 'info', 'warning', 'error', 'confirm'].forEach((type, index) => {
          setTimeout(() => {
            const isConfirm = type === 'confirm'
            IPEModal.notify(
              type,
              {
                content: `This is a ${type || 'default'} toast.`,
                closeAfter: isConfirm ? 0 : 3000,
                okBtn: isConfirm ? { label: 'Yes, of course!' } : undefined,
                cancelBtn: isConfirm ? { label: 'No, thanks.' } : undefined,
              },
              (result) => {
                alert(`Your choice was: ${result ? 'OK' : 'Cancel'}`)
              }
            )
          }, index * 50)
        })
      }}
    >
      Show Toasts
    </button>
  </div>
)

const root = document.getElementById('app')!

root.replaceChildren(<App></App>)
