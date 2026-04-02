'use client';

import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { supabase } from '@/app/api/supabaseClient';
import { compressImageFile } from '@/lib/imageCompress';
import { convertHeicLikeToJpeg, isHeicOrHeif, MOBILE_IMAGE_EXTENSIONS } from '@/lib/heicToJpeg';

type UseProfileEditorArgs = {
  userId: string | null | undefined;
  householdId: string | null;
  profileName: string;
  setProfileAvatarUrl: (value: string | null) => void;
  setProfileAvatarLoadFailed: (value: boolean) => void;
  applyOwnDisplayName: (userId: string, displayName: string) => void;
  applyOwnAvatarUrl: (userId: string, avatarUrl: string) => void;
  onStatus: (message: string, tone?: 'success' | 'error' | 'info') => void;
};

export function useProfileEditor({
  userId,
  householdId,
  profileName,
  setProfileAvatarUrl,
  setProfileAvatarLoadFailed,
  applyOwnDisplayName,
  applyOwnAvatarUrl,
  onStatus,
}: UseProfileEditorArgs) {
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileAvatarUploading, setProfileAvatarUploading] = useState(false);
  const profileAvatarInputRef = useRef<HTMLInputElement>(null);

  const handleProfileSave = useCallback(async () => {
    if (!userId || !householdId) return;
    const trimmed = profileName.trim();
    if (!trimmed) {
      onStatus('이름을 입력하세요.', 'info');
      return;
    }

    setProfileSaving(true);
    const { error } = await supabase
      .from('members')
      .update({ display_name: trimmed })
      .eq('household_id', householdId)
      .eq('user_id', userId);

    if (error) {
      onStatus(`프로필 저장 실패: ${error.message}`, 'error');
      setProfileSaving(false);
      return;
    }

    applyOwnDisplayName(userId, trimmed);
    onStatus('이름이 저장되었습니다.', 'success');
    setProfileSaving(false);
  }, [userId, householdId, profileName, applyOwnDisplayName, onStatus]);

  const handleProfileAvatarChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) {
        onStatus('파일이 선택되지 않았습니다. 다시 시도해 주세요.', 'info');
        return;
      }
      if (!userId || !householdId) {
        onStatus('로그인 후 다시 시도해 주세요.', 'error');
        return;
      }
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || /\.(heic|heif)$/i.test(file.name);
      const isImageType = file.type.startsWith('image/');
      const isImageExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext);
      if (!isImageType && !isImageExt) {
        onStatus('사진 파일만 선택해 주세요. (jpg, png, heic 등)', 'info');
        return;
      }
      setProfileAvatarUploading(true);
      onStatus('프로필 사진 업로드 중...', 'info');
      let fileToUpload: File = file;
      if (isHeicOrHeif(file) && typeof window !== 'undefined') {
        try {
          fileToUpload = await convertHeicLikeToJpeg(file);
        } catch {
          onStatus('HEIC 변환에 실패했습니다. JPEG/PNG로 올려 주세요.', 'error');
          setProfileAvatarUploading(false);
          return;
        }
      }
      try {
        const compressed = await compressImageFile(fileToUpload, { maxSide: 640, quality: 0.78 });
        fileToUpload = compressed.file;
      } catch {
        // Fall back to original/converted file.
      }
      const uploadExt = fileToUpload.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${householdId}/${userId}.${uploadExt}`;
      const contentType = fileToUpload.type.startsWith('image/')
        ? fileToUpload.type
        : `image/${uploadExt === 'jpg' || uploadExt === 'jpeg' ? 'jpeg' : uploadExt === 'png' ? 'png' : uploadExt === 'gif' ? 'gif' : 'webp'}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, fileToUpload, {
        contentType,
        upsert: true,
      });
      if (uploadError) {
        const msg = uploadError.message || '';
        const hint = /bucket|policy|row-level|RLS|storage/i.test(msg)
          ? ' → Supabase Storage에 "avatars" 버킷을 만들고, DEPLOY.md 프로필 사진 ②·③을 했는지 확인해 주세요.'
          : '';
        onStatus(`프로필 사진 업로드 실패: ${msg}${hint}`, 'error');
        setProfileAvatarUploading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      const { error: updateError } = await supabase
        .from('members')
        .update({ avatar_url: publicUrl })
        .eq('household_id', householdId)
        .eq('user_id', userId);
      if (updateError) {
        const msg = updateError.message || '';
        const hint = /avatar_url|column|does not exist/i.test(msg)
          ? ' → SQL Editor에서 실행: ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_url TEXT;'
          : '';
        onStatus(`프로필 저장 실패: ${msg}${hint}`, 'error');
        setProfileAvatarUploading(false);
        return;
      }
      setProfileAvatarUrl(publicUrl + (publicUrl.includes('?') ? '&' : '?') + 't=' + Date.now());
      setProfileAvatarLoadFailed(false);
      applyOwnAvatarUrl(userId, publicUrl);
      onStatus('프로필 사진이 변경되었습니다.', 'success');
      setProfileAvatarUploading(false);
    },
    [userId, householdId, setProfileAvatarUrl, setProfileAvatarLoadFailed, applyOwnAvatarUrl, onStatus]
  );

  return {
    profileSaving,
    profileAvatarUploading,
    profileAvatarInputRef,
    handleProfileSave,
    handleProfileAvatarChange,
  };
}
