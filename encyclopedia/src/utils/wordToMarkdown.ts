import type { Word } from '../types/word'

export function wordToMarkdown(w: Word): string {
  const lines: string[] = []

  lines.push(`# ${w.word}`)

  if (w.pronunciation) {
    lines.push(`**Pronunciation:** /${w.pronunciation}/`)
  }

  const posCefr: string[] = []
  if (w.partOfSpeech?.length) {
    posCefr.push(`**POS:** ${w.partOfSpeech.join(', ')}`)
  }
  if (w.cefrLevel) {
    posCefr.push(`**CEFR:** ${w.cefrLevel}`)
  }
  if (posCefr.length) {
    lines.push(posCefr.join(' | '))
  }

  if (w.forms) {
    lines.push(`**Forms:** ${w.forms}`)
  }

  if (w.definitions && w.definitions.length > 0) {
    lines.push('')
    lines.push('## Definitions')
    for (const def of w.definitions) {
      const ctx = def.context ? `[${def.context}] ` : ''
      lines.push(`${def.sense}. ${ctx}${def.text}`)
      if (def.examples) {
        for (const ex of def.examples) {
          lines.push(`   - ${ex}`)
        }
      }
    }
  }

  if (w.mainExamples && w.mainExamples.length > 0) {
    lines.push('')
    lines.push('## Examples')
    for (const ex of w.mainExamples) {
      lines.push(`> ${ex}`)
    }
  }

  if (w.usageNote) {
    lines.push('')
    lines.push('## Usage Note')
    lines.push(w.usageNote)
  }

  if (w.comparisons && w.comparisons.length > 0) {
    lines.push('')
    lines.push('## Comparisons')
    lines.push('| Word | Description |')
    lines.push('|------|-------------|')
    for (const c of w.comparisons) {
      lines.push(`| ${c.word} | ${c.description} |`)
    }
  }

  if (w.collocations && w.collocations.length > 0) {
    lines.push('')
    lines.push('## Collocations')
    for (const col of w.collocations) {
      const text = typeof col === 'string' ? col : (col.text || col.phrase || '')
      lines.push(`- ${text}`)
    }
  }

  if (w.idioms && w.idioms.length > 0) {
    lines.push('')
    lines.push('## Idioms')
    for (const idiom of w.idioms) {
      const explanation = idiom.explanation ? ` — ${idiom.explanation}` : ''
      lines.push(`- **${idiom.phrase}**${explanation}`)
    }
  }

  if (w.relatedForms && w.relatedForms.length > 0) {
    lines.push('')
    lines.push('## Related Forms')
    for (const rf of w.relatedForms) {
      const pos = rf.partOfSpeech ? ` (${rf.partOfSpeech})` : ''
      const desc = rf.description ? ` — ${rf.description}` : ''
      lines.push(`- **${rf.word}**${pos}${desc}`)
    }
  }

  if (w.wordHistory) {
    lines.push('')
    lines.push('## Word History')
    lines.push(w.wordHistory)
  }

  if (w.contextStory) {
    lines.push('')
    lines.push('## Context Story')
    lines.push(w.contextStory)
  }

  return lines.join('\n') + '\n'
}
