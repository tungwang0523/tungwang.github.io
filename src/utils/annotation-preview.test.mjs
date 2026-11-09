import assert from 'node:assert/strict';
import test from 'node:test';
import { annotationPreview } from './annotation-preview.mjs';

test('short previews indicate that later paragraphs are hidden', () => {
  assert.equal(annotationPreview('<p>为什么呢。</p><p>解释。</p>'), '为什么呢…');
  assert.equal(annotationPreview('<p>Why?!…</p><p>An explanation.</p>'), 'Why…');
});

test('a complete single paragraph does not gain an unnecessary ellipsis', () => {
  assert.equal(annotationPreview('<p>A complete note.</p>'), 'A complete note.');
});

test('removes all trailing punctuation, including encoded quotation marks', () => {
  assert.equal(annotationPreview('<p>Text?!&rdquo;</p><p>More.</p>'), 'Text…');
  assert.equal(annotationPreview('<p>文字。&#x300d;</p><p>后文。</p>'), '文字…');
});

test('preserves encoded text and removes interactive or decorative markup', () => {
  assert.equal(annotationPreview('<p><em>A &amp; B</em>.</p><p>More.</p>'), 'A &amp; B…');
  assert.equal(annotationPreview('<p>A &amp;</p><p>More.</p>'), 'A &amp;…');
  assert.equal(annotationPreview('<p>A <a href="/">link</a>.</p><p>More.</p>'), 'A link…');
});

test('skips empty image paragraphs and accounts for hidden media', () => {
  assert.equal(annotationPreview('<p><img src="/a.jpg" /></p><p>Text.</p>'), 'Text…');
  assert.equal(annotationPreview('<p>Text.</p><figure><img src="/a.jpg" /></figure>'), 'Text…');
  assert.equal(annotationPreview('<p><img src="/a.jpg" /></p>'), '');
});
