/**
 * ML Video Extractor
 * 
 * Helper robusto para extrair informação de vídeo do payload do Mercado Livre.
 * Procura por múltiplas evidências no objeto do item.
 */

/**
 * Resultado da extração de vídeo
 */
export interface VideoExtractionResult {
  hasVideo: boolean | null; // true = tem vídeo, false = confirmado que não tem, null = não detectável
  evidence: string[];
  isDetectable: boolean; // true se foi possível determinar via API
  clipsEvidence?: {
    source: string; // ex: "ml-video-extractor/items", "ml-video-extractor/clips"
    status: number | null; // HTTP status code se disponível
    signals: string[]; // ex: ["found_published_clip", "field:clips_count=1"]
    rawShape?: string; // ex: "array", "object", "empty", "html", "string"
  };
}

/**
 * Extrai informação de vídeo do payload do Mercado Livre
 * 
 * Procura por múltiplas evidências:
 * - item.video_id (string não vazia)
 * - item.videos (array não vazio)
 * - Qualquer chave top-level que contenha "video" (case-insensitive)
 * - item.attributes: procurar IDs/nomes que sugiram vídeo
 * - item.tags: procurar algo como video/has_video
 */
export function extractHasVideoFromMlItem(
  item: unknown,
  httpStatus?: number | null
): VideoExtractionResult {
  const evidence: string[] = [];
  const signals: string[] = [];
  let hasVideo: boolean | null = null; // Inicia como null (não detectável)
  let isDetectable = false;
  let rawShape: string | undefined;

  if (!item || typeof item !== 'object') {
    rawShape = typeof item;
    return { 
      hasVideo: null, 
      evidence: [`item is not an object (type: ${rawShape})`], 
      isDetectable: false,
      clipsEvidence: {
        source: 'ml-video-extractor/items',
        status: httpStatus ?? null,
        signals: [`invalid_shape:${rawShape}`],
        rawShape,
      },
    };
  }

  const itemObj = item as Record<string, unknown>;
  
  // HOTFIX: Detectar se response veio como HTML ou string (shape drift)
  if ('html' in itemObj || typeof itemObj === 'string' || 
      (Object.keys(itemObj).length === 0 && !('video_id' in itemObj) && !('videos' in itemObj))) {
    rawShape = 'html_or_unexpected';
    return {
      hasVideo: null,
      evidence: ['response shape is HTML or unexpected format'],
      isDetectable: false,
      clipsEvidence: {
        source: 'ml-video-extractor/items',
        status: httpStatus ?? null,
        signals: ['shape_drift:html_or_unexpected'],
        rawShape,
      },
    };
  }

  // 1. Verificar video_id (string não vazia)
  if ('video_id' in itemObj) {
    const videoId = itemObj.video_id;
    if (typeof videoId === 'string' && videoId.trim().length > 0) {
      hasVideo = true;
      isDetectable = true;
      evidence.push(`video_id present: "${videoId.substring(0, 20)}${videoId.length > 20 ? '...' : ''}"`);
      signals.push('found_published_clip');
      signals.push(`field:video_id=${videoId.substring(0, 10)}...`);
    } else if (videoId === null) {
      // video_id null explicitamente = confirmado que não tem vídeo (apenas se status 200)
      if (httpStatus === 200) {
        hasVideo = false;
        isDetectable = true;
        evidence.push('video_id is null (explicitly no video)');
        signals.push('field:video_id=null');
      } else {
        // Se não for 200, não podemos confiar que null = sem vídeo
        hasVideo = null;
        evidence.push('video_id is null but status is not 200 (inconclusive)');
        signals.push('field:video_id=null_inconclusive');
      }
    } else {
      evidence.push('video_id is empty or invalid');
      signals.push('field:video_id=empty_or_invalid');
    }
  }

  // 2. Verificar videos (array não vazio)
  if ('videos' in itemObj) {
    const videos = itemObj.videos;
    rawShape = Array.isArray(videos) ? 'array' : videos === null ? 'null' : typeof videos;
    
    if (Array.isArray(videos) && videos.length > 0) {
      hasVideo = true;
      isDetectable = true;
      evidence.push(`videos array present with ${videos.length} item(s)`);
      signals.push('found_published_clip');
      signals.push(`field:videos_count=${videos.length}`);
      
      // Verificar se tem IDs válidos
      const validVideos = videos.filter((v: unknown) => {
        if (typeof v === 'object' && v !== null) {
          const vObj = v as Record<string, unknown>;
          return vObj.id && typeof vObj.id === 'string' && vObj.id.trim().length > 0;
        }
        return false;
      });
      if (validVideos.length > 0) {
        evidence.push(`videos array has ${validVideos.length} valid video ID(s)`);
        signals.push(`field:valid_videos_count=${validVideos.length}`);
      }
    } else if (Array.isArray(videos) && videos.length === 0) {
      // Array vazio = confirmado que não tem vídeos (apenas se status 200)
      if (httpStatus === 200) {
        hasVideo = false;
        isDetectable = true;
        evidence.push('videos array is empty');
        signals.push('field:videos_count=0');
      } else {
        hasVideo = null;
        evidence.push('videos array is empty but status is not 200 (inconclusive)');
        signals.push('field:videos_count=0_inconclusive');
      }
    } else if (videos === null) {
      // videos null explicitamente = confirmado que não tem vídeos (apenas se status 200)
      if (httpStatus === 200) {
        hasVideo = false;
        isDetectable = true;
        evidence.push('videos is null (explicitly no videos)');
        signals.push('field:videos=null');
      } else {
        hasVideo = null;
        evidence.push('videos is null but status is not 200 (inconclusive)');
        signals.push('field:videos=null_inconclusive');
      }
    } else {
      // Shape inesperado
      hasVideo = null;
      evidence.push(`videos field has unexpected shape: ${rawShape}`);
      signals.push(`shape_drift:videos=${rawShape}`);
    }
  }

  // 3. Procurar chaves top-level que contenham "video" (case-insensitive)
  const keysWithVideo: string[] = [];
  for (const key in itemObj) {
    if (key.toLowerCase().includes('video')) {
      keysWithVideo.push(key);
      const value = itemObj[key];
      if (value !== null && value !== undefined) {
        if (typeof value === 'string' && value.trim().length > 0) {
          hasVideo = true;
          evidence.push(`key "${key}" contains non-empty string`);
        } else if (Array.isArray(value) && value.length > 0) {
          hasVideo = true;
          evidence.push(`key "${key}" contains non-empty array`);
        } else if (typeof value === 'boolean' && value === true) {
          hasVideo = true;
          evidence.push(`key "${key}" is true`);
        } else if (typeof value === 'object' && value !== null) {
          hasVideo = true;
          evidence.push(`key "${key}" contains object`);
        }
      }
    }
  }
  if (keysWithVideo.length > 0) {
    evidence.push(`keysWithVideo: [${keysWithVideo.join(', ')}]`);
  }

  // 4. Verificar attributes (se existir)
  if ('attributes' in itemObj && Array.isArray(itemObj.attributes)) {
    const attributes = itemObj.attributes as Array<{ id?: string; name?: string; value_name?: string; value_id?: string }>;
    const videoAttributes = attributes.filter(attr => {
      const id = (attr.id || '').toUpperCase();
      const name = (attr.name || '').toUpperCase();
      return id.includes('VIDEO') || name.includes('VIDEO') || id.includes('MEDIA') || name.includes('MEDIA');
    });
    
    if (videoAttributes.length > 0) {
      hasVideo = true;
      evidence.push(`attributes has ${videoAttributes.length} video-related attribute(s): ${videoAttributes.map(a => a.id || a.name).join(', ')}`);
    }
  }

  // 5. Verificar tags (se existir)
  if ('tags' in itemObj) {
    const tags = itemObj.tags;
    if (Array.isArray(tags)) {
      const videoTags = tags.filter((tag: unknown) => {
        if (typeof tag === 'string') {
          return tag.toLowerCase().includes('video');
        }
        return false;
      });
      if (videoTags.length > 0) {
        hasVideo = true;
        evidence.push(`tags contains video-related: [${videoTags.join(', ')}]`);
      }
    }
  }

  // Se não encontrou nenhuma evidência, registrar
  if (evidence.length === 0) {
    evidence.push('no video-related fields found');
  }

  // HOTFIX: Se encontrou evidências positivas mas isDetectable ainda é false, marcar como detectável
  if (hasVideo === true && !isDetectable) {
    isDetectable = true;
  }

  // Se não foi detectável (null), garantir que retorna null
  if (!isDetectable && hasVideo !== true) {
    hasVideo = null;
  }

  // Se não encontrou nenhuma evidência, registrar
  if (evidence.length === 0) {
    evidence.push('no video-related fields found');
    signals.push('no_video_fields');
  }

  return { 
    hasVideo, 
    evidence, 
    isDetectable,
    clipsEvidence: {
      source: 'ml-video-extractor/items',
      status: httpStatus ?? null,
      signals: signals.length > 0 ? signals : ['no_signals'],
      rawShape: rawShape || 'object',
    },
  };
}

