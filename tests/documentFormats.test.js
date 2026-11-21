import { describe, expect, it } from 'vitest'
import {
  htmlToMarkdown, markdownToHtml, markdownToPlainText, parseInline, parseMarkdown,
  plainTextToMarkdown, sanitizeUrl, titleFromMarkdown
} from '../src/lib/documentMarkdown.js'
import {
  DOCX_MIME, buildDocxBlob, documentKind, importDocx, markdownExport,
  resolveAssetReferences, textExport
} from '../src/lib/documentFormats.js'

const sampleAsset = {
  id: 'asset_1',
  name: 'Catalyst spectrum',
  kind: 'image',
  data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/wFfCAAAAABJRU5ErkJggg==',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

describe('document import normalization', () => {
  it('converts Word and Google Docs HTML into reviewable Markdown', () => {
    const html = `
      <h1>Catalyst study</h1>
      <p><strong>Methods</strong> used <em>three</em> runs and <a href="https://example.org/paper">a source</a>.</p>
      <ul><li>First item</li><li>Second <span style="font-weight:700">item</span></li></ul>
      <table><tr><th>Run</th><th>Rate</th></tr><tr><td>1</td><td>2.4</td></tr></table>
      <p><img src="data:image/png;base64,AAAA" alt="Spectrum"></p>
      <script>alert('x')</script>
    `
    const markdown = htmlToMarkdown(html)
    expect(markdown).toContain('# Catalyst study')
    expect(markdown).toContain('**Methods** used *three* runs')
    expect(markdown).toContain('[a source](https://example.org/paper)')
    expect(markdown).toContain('- First item')
    expect(markdown).toContain('| Run | Rate |')
    expect(markdown).toContain('![Spectrum](data:image/png;base64,AAAA)')
    expect(markdown).not.toContain('alert(')
  })

  it('keeps boundary spaces outside adjacent Word formatting runs', () => {
    expect(htmlToMarkdown('<p><strong>The method was </strong><em>repeatable.</em></p>'))
      .toBe('**The method was** *repeatable.*')
    expect(plainTextToMarkdown('\uFEFF## Existing heading\nText'))
      .toBe('## Existing heading\nText')
  })

  it('drops unsafe destinations and preserves pasted line structure', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('')
    expect(sanitizeUrl('data:text/html;base64,AAAA')).toBe('')
    expect(sanitizeUrl('https://example.org')).toBe('https://example.org')
    expect(sanitizeUrl('data:image/png;base64,AAAA', { image: true })).toBe('data:image/png;base64,AAAA')
    expect(htmlToMarkdown('<a href="javascript:alert(1)">Bad</a>')).toBe('Bad')
    expect(plainTextToMarkdown('First line\nSecond line\n\nSecond paragraph')).toBe('First line  \nSecond line\n\nSecond paragraph')
    expect(plainTextToMarkdown('## Existing heading\nText')).toContain('## Existing heading')
  })

  it('detects document types without relying only on MIME type', () => {
    expect(documentKind({ name: 'paper.DOCX', type: '' })).toBe('docx')
    expect(documentKind({ name: 'notes.md', type: 'text/plain' })).toBe('md')
    expect(documentKind({ name: 'draft.txt', type: '' })).toBe('txt')
    expect(documentKind({ name: 'paper.docx', type: DOCX_MIME })).toBe('docx')
    expect(documentKind({ name: 'image.png', type: 'image/png' })).toBe('')
  })
})

describe('Markdown parsing', () => {
  it('keeps headings, lists, quotes, code and tables as distinct blocks', () => {
    const blocks = parseMarkdown(`# Title\n\nIntro with **bold** and [a link](https://example.org).\n\n- One\n- Two\n\n> A quote\n\n\`\`\`js\nconst x = 1\n\`\`\`\n\n| A | B |\n| --- | --- |\n| 1 | 2 |`)
    expect(blocks.map((block) => block.type)).toEqual(['heading', 'paragraph', 'list', 'quote', 'code', 'table'])
    expect(blocks[0]).toMatchObject({ level: 1, text: 'Title' })
    expect(blocks[2].items).toEqual(['One', 'Two'])
    expect(blocks[5].rows).toEqual([['A', 'B'], ['1', '2']])
  })

  it('parses inline formatting, images and links into typed runs', () => {
    const runs = parseInline('A **strong** *em* <u>under</u> `code` [site](https://example.org) ![plot](asset://asset_1)')
    expect(runs.map((run) => run.type)).toEqual([
      'text', 'strong', 'text', 'em', 'text', 'underline', 'text', 'code', 'text', 'link', 'text', 'image'
    ])
    expect(runs.find((run) => run.type === 'link').href).toBe('https://example.org')
    expect(runs.find((run) => run.type === 'image').src).toBe('asset://asset_1')
  })

  it('renders a sanitised preview and resolves saved asset images', () => {
    const html = markdownToHtml(
      '# Study\n\n<img src="x" onerror="alert(1)" /> **Bold** [site](javascript:alert(1)) ![plot](asset://asset_1)',
      { resolveSource: (id) => id === 'asset_1' ? sampleAsset.data : '' }
    )
    expect(html).toContain('<h1>Study</h1>')
    expect(html).toContain('<strong>Bold</strong>')
    expect(html).toContain(`src="${sampleAsset.data}"`)
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('<img src="x"')
  })

  it('flattens Markdown to readable text and derives a title', () => {
    const markdown = '# Study\n\n## Results\nThe rate rose (Smith, 2024). See [source](https://example.org).'
    expect(markdownToPlainText(markdown)).toContain('The rate rose (Smith, 2024). See source (https://example.org).')
    expect(titleFromMarkdown(markdown, 'file-name.docx')).toBe('Study')
    expect(titleFromMarkdown('No headings', 'my-draft.md')).toBe('my draft')
  })
})

describe('asset-backed export', () => {
  it('embeds saved image assets and reports missing or oversized assets', () => {
    const result = resolveAssetReferences(
      '![Spectrum](asset://asset_1)\n\n[Missing](asset://nope)',
      [sampleAsset]
    )
    expect(result.markdown).toContain(sampleAsset.data)
    expect(result.markdown).toContain('Missing (saved asset unavailable)')
    expect(result.warnings.join(' ')).toMatch(/not found/)
    expect(resolveAssetReferences('![Big](asset://asset_1)', [{ ...sampleAsset, data: `data:image/png;base64,${'A'.repeat(12_000_000)}` }]).warnings.join(' ')).toMatch(/too large/)
  })

  it('exports portable Markdown and plain text', () => {
    const markdown = markdownExport('# Study\n\n![Spectrum](asset://asset_1)', [sampleAsset])
    expect(markdown.text).toContain(sampleAsset.data)
    const text = textExport('![Spectrum](asset://asset_1) and [site](https://example.org)', [sampleAsset])
    expect(text.text).toContain('[Image: Spectrum]')
    expect(text.text).toContain('site (https://example.org)')
  })
})

describe('Word file round trip', () => {
  it('imports headings and paragraphs from a real .docx file', async () => {
    const docx = await import('docx')
    const document = new docx.Document({
      sections: [{ children: [
        new docx.Paragraph({ text: 'Catalyst results', heading: docx.HeadingLevel.HEADING_1 }),
        new docx.Paragraph({ children: [
          new docx.TextRun({ text: 'The rate ', bold: true }),
          new docx.TextRun({ text: 'increased.', italics: true })
        ] })
      ] }]
    })
    const buffer = await docx.Packer.toBuffer(document)
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    const result = await importDocx(arrayBuffer)
    expect(result.markdown).toContain('# Catalyst results')
    expect(result.markdown).toContain('**The rate**')
    expect(result.markdown).toContain('*increased.*')
  })

  it('builds a downloadable .docx blob from Markdown', async () => {
    const result = await buildDocxBlob(
      '# Paper\n\n**Methods** were fixed.\n\n- First\n- Second\n\n![Spectrum](asset://asset_1)',
      { title: 'Paper', assets: [sampleAsset] }
    )
    expect(result.blob).toBeInstanceOf(Blob)
    expect(result.blob.size).toBeGreaterThan(1000)
  }, 20000)
})
