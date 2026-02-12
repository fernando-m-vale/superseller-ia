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
export function extractHasVideoFromMlItem(item: unknown): VideoExtractionResult {
  const evidence: string[] = [];
  let hasVideo: boolean | null = null; // Inicia como null (não detectável)
  let isDetectable = false;

  if (!item || typeof item !== 'object') {
    return { hasVideo: null, evidence: ['item is not an object'], isDetectable: false };
  }

  const itemObj = item as Record<string, unknown>;

  // 1. Verificar video_id (string não vazia)
  if ('video_id' in itemObj) {
    const videoId = itemObj.video_id;
    if (typeof videoId === 'string' && videoId.trim().length > 0) {
      hasVideo = true;
      isDetectable = true;
      evidence.push(`video_id present: "${videoId.substring(0, 20)}${videoId.length > 20 ? '...' : ''}"`);
    } else if (videoId === null) {
      // video_id null explicitamente = confirmado que não tem vídeo
      hasVideo = false;
      isDetectable = true;
      evidence.push('video_id is null (explicitly no video)');
    } else {
      evidence.push('video_id is empty or invalid');
    }
  }

  // 2. Verificar videos (array não vazio)
  if ('videos' in itemObj) {
    const videos = itemObj.videos;
    if (Array.isArray(videos) && videos.length > 0) {
      hasVideo = true;
      isDetectable = true;
      evidence.push(`videos array present with ${videos.length} item(s)`);
      
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
      }
    } else if (Array.isArray(videos) && videos.length === 0) {
      // Array vazio = confirmado que não tem vídeos
      hasVideo = false;
      isDetectable = true;
      evidence.push('videos array is empty');
    } else if (videos === null) {
      // videos null explicitamente = confirmado que não tem vídeos
      hasVideo = false;
      isDetectable = true;
      evidence.push('videos is null (explicitly no videos)');
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

  return { hasVideo, evidence, isDetectable };
}

