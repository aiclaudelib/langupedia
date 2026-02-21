import { useState, useRef, useEffect } from 'react'
import type { Word } from '../types/word'
import { formatText } from '../utils/formatText'
import { slugify } from '../utils/slugify'
import { resolveAssetPath } from '../lib/assetPath'
import { wordToMarkdown } from '../utils/wordToMarkdown'
import { downloadMarkdown } from '../utils/downloadMarkdown'
import WordHistory from './WordHistory'
import ContextStory from './ContextStory'
import PronunciationPlayer from './PronunciationPlayer'

interface WordCardProps {
  word: Word
  lang: string
  onLangChange: (lang: string) => void
  onListenClick?: (word: string) => void
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

export default function WordCard({ word: w, lang, onLangChange, onListenClick }: WordCardProps) {
  const [shareOpen, setShareOpen] = useState(false)
  const shareRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!shareOpen) return
    const handleClick = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false)
      }
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [shareOpen])

  return (
    <article className="word-card" id={`card-${slugify(w.word)}`} data-word={w.word}>
      <div className="card-top-section">
        <div className="card-top-left">
          <div className="card-header-row">
            <h2 className="card-word">{w.word}</h2>
            <div className="card-header-actions">
              <div className="card-share" ref={shareRef}>
                <button
                  className="card-share-btn"
                  onClick={() => setShareOpen((v) => !v)}
                  aria-label={`Share ${w.word}`}
                  title="Share"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                </button>
                {shareOpen && (
                  <div className="header-dropdown">
                    <button
                      className="header-dropdown-item"
                      onClick={() => { downloadMarkdown(wordToMarkdown(w), `${w.word}.md`); setShareOpen(false) }}
                    >
                      Download Markdown
                    </button>
                  </div>
                )}
              </div>
              <div className="card-lang-toggle">
                <button
                  className={`card-lang-btn${lang === 'ru' ? ' active' : ''}`}
                  onClick={() => onLangChange('ru')}
                >
                  RU
                </button>
                <button
                  className={`card-lang-btn${lang === 'en' ? ' active' : ''}`}
                  onClick={() => onLangChange('en')}
                >
                  EN
                </button>
              </div>
            </div>
          </div>

          {w.pronunciation && (
            <div className="card-pronunciation">
              /{w.pronunciation}/
              {w.audio && <PronunciationPlayer audio={w.audio} />}
            </div>
          )}

          {(w.partOfSpeech?.length || w.cefrLevel) && (
            <div className="pos-badges">
              {w.partOfSpeech?.map((pos) => (
                <span key={pos} className="pos-badge">{pos}</span>
              ))}
              {w.cefrLevel && (
                <span className={`cefr-badge cefr-${w.cefrLevel.toLowerCase()}`}>{w.cefrLevel}</span>
              )}
            </div>
          )}

          {w.forms && (
            <div
              className="card-forms"
              dangerouslySetInnerHTML={{ __html: formatText(w.forms) }}
            />
          )}

          {w.definitions && w.definitions.length > 0 && (
            <>
              <h3 className="section-heading">Definitions</h3>
              {w.definitions.map((def, i) => (
                <div key={i} className="definition-item">
                  <span className="def-number">{def.sense}.</span>
                  {def.context && (
                    <span className="def-context">[{escapeHtml(def.context)}]</span>
                  )}
                  <span
                    className="def-text"
                    dangerouslySetInnerHTML={{ __html: formatText(def.text) }}
                  />
                  {def.examples && def.examples.length > 0 && (
                    <div className="def-examples">
                      {def.examples.map((ex, i) => (
                        <div
                          key={i}
                          className="def-example"
                          dangerouslySetInnerHTML={{ __html: formatText(ex) }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {w.image ? (
          <div className="card-top-right">
            <img
              src={resolveAssetPath(w.image)}
              alt={`Mnemonic illustration for ${w.word}`}
              className="card-mnemonic-image"
              loading="lazy"
            />
            {onListenClick && (
              <button
                className="youglish-btn"
                onClick={() => onListenClick(w.word)}
                aria-label={`Listen to ${w.word}`}
              >
                <span className="youglish-btn-icon">&#9654;&#xFE0E;</span>
                Watch in context
              </button>
            )}
          </div>
        ) : onListenClick && (
          <div className="card-top-right card-top-right--no-image">
            <button
              className="youglish-btn"
              onClick={() => onListenClick(w.word)}
              aria-label={`Listen to ${w.word}`}
            >
              <span className="youglish-btn-icon">&#9654;&#xFE0E;</span>
              Watch in context
            </button>
          </div>
        )}
      </div>

      {w.mainExamples && w.mainExamples.length > 0 && (
        <>
          <h3 className="section-heading">Examples</h3>
          {w.mainExamples.map((ex, i) => (
            <div key={i} className="example-block">
              <span
                className="example-text"
                dangerouslySetInnerHTML={{ __html: formatText(ex) }}
              />
            </div>
          ))}
        </>
      )}

      {w.usageNote && (
        <>
          <h3 className="section-heading">Usage Note</h3>
          <div className="usage-note">
            <div
              className="usage-note-text"
              dangerouslySetInnerHTML={{ __html: formatText(w.usageNote) }}
            />
          </div>
        </>
      )}

      {w.comparisons && w.comparisons.length > 0 && (
        <>
          <h3 className="section-heading">Comparisons</h3>
          <table className="comparisons-table">
            <thead>
              <tr><th>Word</th><th>Description</th></tr>
            </thead>
            <tbody>
              {w.comparisons.map((c) => (
                <tr key={c.word}>
                  <td>{c.word}</td>
                  <td dangerouslySetInnerHTML={{ __html: formatText(c.description) }} />
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {w.collocations && w.collocations.length > 0 && (
        <>
          <h3 className="section-heading">Collocations</h3>
          <div className="collocations-list">
            {w.collocations.map((col, i) => {
              const text = typeof col === 'string' ? col : (col.text || col.phrase || '')
              return (
                <div
                  key={i}
                  className="collocation-tag"
                  dangerouslySetInnerHTML={{ __html: formatText(text) }}
                />
              )
            })}
          </div>
        </>
      )}

      {w.idioms && w.idioms.length > 0 && (
        <>
          <h3 className="section-heading">Idioms</h3>
          {w.idioms.map((idiom, i) => (
            <div key={i} className="idiom-box">
              <div
                className="idiom-phrase"
                dangerouslySetInnerHTML={{ __html: formatText(idiom.phrase) }}
              />
              {idiom.explanation && (
                <div
                  className="idiom-explanation"
                  dangerouslySetInnerHTML={{ __html: formatText(idiom.explanation) }}
                />
              )}
            </div>
          ))}
        </>
      )}

      {w.relatedForms && w.relatedForms.length > 0 && (
        <>
          <h3 className="section-heading">Related Forms</h3>
          <div className="related-forms-list">
            {w.relatedForms.map((rf, i) => (
              <div key={i} className="related-form-item">
                <span className="related-form-word">{rf.word}</span>
                {rf.partOfSpeech && (
                  <span className="related-form-pos">({rf.partOfSpeech})</span>
                )}
                {rf.description && (
                  <span
                    className="related-form-desc"
                    dangerouslySetInnerHTML={{ __html: formatText(rf.description) }}
                  />
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {w.wordHistory && <WordHistory text={w.wordHistory} />}
      {w.contextStory && <ContextStory text={w.contextStory} />}
    </article>
  )
}
