// 有道词典 provider(dict.youdao.com/jsonapi)。
// 非官方网页接口,免费、免 key。返回中文释义、词性、音标、发音、中英例句。
// 质量明显优于 dictionaryapi.dev 的英文释义。
//
// 注意:该接口为网页内部使用,非公开 API;可能限流或改版。上架时需在隐私政策说明。
// 词典仅用于英文单词查询(中文查词可走机翻)。

import type { NormalizedDictionaryEntry, DictionaryMeaning } from '@/shared/types';

const BASE = 'https://dict.youdao.com/jsonapi';
const VOICE_BASE = 'https://dict.youdao.com/dictvoice';

interface YdWord {
  usphone?: string;
  ukphone?: string;
  usspeech?: string;
  ukspeech?: string;
  trs?: { tr: { l: { i: string[] } }[] }[];
}
interface YdEc {
  exam_type?: string[];
  word?: YdWord[];
}
interface YdSentencePair {
  'sentence-eng'?: string;
  'sentence-translation'?: string;
}
interface YdResponse {
  ec?: YdEc;
  simple?: { word?: YdWord[] };
  blng_sents_part?: { 'sentence-pair'?: YdSentencePair[] };
  lang?: string;
}

export async function fetchYoudao(
  text: string,
  lang: string,
  signal?: AbortSignal,
): Promise<NormalizedDictionaryEntry | null> {
  const clean = text.trim();
  // 仅英文单词/短语(纯字母,可含连字符/空格/撇号)
  if (lang !== 'en' && lang !== 'auto') return null;
  if (!/^[A-Za-z][A-Za-z\s'\-]{0,60}$/.test(clean)) return null;

  const url = `${BASE}?q=${encodeURIComponent(clean.toLowerCase())}`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  const data = (await res.json()) as YdResponse;

  const word = data.ec?.word?.[0] ?? data.simple?.word?.[0];
  if (!word) return null;

  return normalize(clean, data, word);
}

function normalize(
  word0: string,
  data: YdResponse,
  word: YdWord,
): NormalizedDictionaryEntry {
  const meanings: DictionaryMeaning[] = [];

  // 解析释义:trs[].tr[].l.i[] 形如 "adj. 短暂的" → {pos:'adj.', definitions:[...]}
  for (const trGroup of word.trs ?? []) {
    for (const tr of trGroup.tr ?? []) {
      const lines = tr?.l?.i ?? [];
      if (!lines.length) continue;
      // 一组 tr 通常同一词性;每行可能是 "adj. 释义1;释义2"
      const text = lines.join(' ');
      const parsed = parseLine(text);
      if (parsed) {
        // 合并到同词性的 meaning
        const existing = meanings.find((m) => m.partOfSpeech === parsed.pos);
        if (existing) existing.definitions.push(...parsed.definitions);
        else meanings.push({ partOfSpeech: parsed.pos, definitions: parsed.definitions });
      }
    }
  }

  // 音标:优先英音
  const phonetic = word.ukphone || word.usphone;
  // 发音 URL:由 usspeech/ukspeech 拼接(dictvoice?audio=word&type=2英/1美)
  const voiceParam = word.ukspeech || word.usspeech;
  const audioUrl = voiceParam ? `${VOICE_BASE}?audio=${encodeURIComponent(voiceParam.split('&')[0])}&type=${word.ukspeech ? 2 : 1}` : undefined;

  // 例句(取前3个双语例句,挂在第一个 meaning 上或单独)
  const pairs = data.blng_sents_part?.['sentence-pair'] ?? [];
  const examples = pairs.slice(0, 3).map((p) => ({
    eng: stripTags(p['sentence-eng'] ?? ''),
    zh: p['sentence-translation'] ?? '',
  }));
  if (examples.length && meanings.length) {
    meanings[0].definitions[0].example =
      (examples[0].eng + '  ' + examples[0].zh).slice(0, 200);
  }

  return {
    word: word0,
    phonetic: phonetic ? `/${phonetic}/` : undefined,
    audioUrl,
    meanings,
    source: 'youdao',
  };
}

/** 解析 "adj. 短暂的;短命的" → { pos:'adj.', definitions:[{definition:'短暂的'},{definition:'短命的'}] } */
function parseLine(
  text: string,
): { pos: string; definitions: { definition: string; example?: string }[] } | null {
  const m = text.match(/^\s*([a-z]+\.)\s*(.*)$/i);
  if (!m) {
    // 无词性前缀,整行作释义,词性标空
    const def = text.trim();
    return def ? { pos: '', definitions: [{ definition: def }] } : null;
  }
  const pos = m[1];
  const rest = m[2];
  const parts = rest
    .split(/[;；]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  return { pos, definitions: parts.map((p) => ({ definition: stripTags(p) })) };
}

function stripTags(s: string): string {
  return s.replace(/<\/?[^>]+>/g, '').trim();
}
