import { Inject, InPageEdit, Schema } from '@/InPageEdit'
import { install, SchemaForm } from 'schemastery-form'
import { h } from 'jsx-dom'

install()

interface TestSchema {
  test: string
  count: number
  active: boolean
  deep: {
    nested: string[]
  }
}
const schema = new Schema<TestSchema>(
  Schema.object({
    test: Schema.string().description('Test String').default('Hello, World!'),
    count: Schema.number().description('Test Number').default(42),
    active: Schema.boolean().description('Test Boolean').default(true),
    deep: Schema.object({
      nested: Schema.array(Schema.string())
        .description('Nested Array of Strings')
        .default(['one', 'two', 'three']),
    }).description('Nested Object'),
  })
)

@Inject(['modal', 'toolbox', 'sitemeta'])
class PluginDebug extends BasePlugin {
  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'debug')
  }

  protected async start() {
    this.ctx.toolbox.addButton({
      id: '_debug',
      icon: '🐞',
      tooltip: 'debug',
      group: 'group2',
      onClick: () => {
        this.showModal()
      },
    })
  }

  showModal() {
    const schemaForm = h('schema-form') as unknown as SchemaForm<TestSchema>
    schemaForm.schema = schema

    let progressBar: HTMLElementTagNameMap['ipe-progress-bar']
    const modal = this.ctx.modal
      .createObject({
        title: 'Debug Info',
        content: (
          <div>
            <h2>Progress Bar</h2>
            <ipe-progress-bar ref={(el) => (progressBar = el)} progress={-1}></ipe-progress-bar>
            <button onClick={() => ((progressBar.progress ||= 0), (progressBar!.progress -= 10))}>
              - 10%
            </button>
            <button onClick={() => (progressBar.progress = -1)}>Set Indeterminate</button>
            <button onClick={() => ((progressBar.progress ||= 0), (progressBar!.progress += 10))}>
              + 10%
            </button>
            <h2>Site Metadata</h2>
            <pre style={{ maxHeight: '20em', overflow: 'auto' }}>
              {JSON.stringify(this.ctx.sitemeta._raw, null, 2)}
            </pre>
            <h2>Schema Playground</h2>
            <h3>web-components</h3>
            {schemaForm}
            <ActionButton
              onClick={() => {
                const data = schemaForm.getData()
                this.ctx.modal.show({
                  sizeClass: 'small',
                  title: 'Form Data',
                  content: (<pre>{JSON.stringify(data, null, 2)}</pre>) as HTMLElement,
                })
              }}
            >
              Get Data
            </ActionButton>
            <h2>MBox</h2>
            {['note', 'tip', 'important', 'warning', 'caution'].map((type, index) => (
              <MBox type={type as any} closeable={index % 2 === 0}>
                {type[0].toUpperCase() + type.slice(1).toLowerCase()} box
              </MBox>
            ))}
            <ipe-mbox type="info" closeable>
              Test web component
            </ipe-mbox>
          </div>
        ) as HTMLElement,
      })
      .init()

    return modal.show()
  }
}

export default PluginDebug
