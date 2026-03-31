'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Search, Settings, X, Plus, CheckSquare2 } from 'lucide-react';
import type { Lang } from '../../app/translations';

export type TabId = 'home' | 'calendar' | 'search' | 'todo';

type BottomTabBarProps = {
  activeTab: TabId;
  onTabChange: (id: TabId) => void;
  t: (key: string) => string;
  highContrast: boolean;
  language: Lang;
  setLanguage: (lang: Lang) => void;
  langLabels: Record<Lang, string>;
  onNameEdit: () => void;
  onProfilePhotoChange: () => void;
  onInviteFamily: () => void;
  onAccessibility: () => void;
  profileAvatarUploading?: boolean;
  /** 홈에서 태그 선택 후 새 글 작성 시, 선택한 로그 태그(DB `place_slug`)를 미리 채우기 */
  writePlaceSlug?: string | null;
};

const ICON_SIZE = 18;
const STROKE = 1.5;

export function BottomTabBar({
  activeTab,
  onTabChange,
  t,
  highContrast,
  language,
  setLanguage,
  langLabels,
  onNameEdit,
  onProfilePhotoChange,
  onInviteFamily,
  onAccessibility,
  profileAvatarUploading = false,
  writePlaceSlug = null,
}: BottomTabBarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pathname = usePathname();
  const showWriteFab = pathname !== '/write';

  const openSettings = () => setSettingsOpen(true);

  const closeAnd = (fn: () => void) => {
    setSettingsOpen(false);
    fn();
  };

  const tabStyle = (isActive: boolean) => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    padding: '6px 4px',
    border: 'none',
    background: isActive ? 'var(--accent-light)' : 'transparent',
    color: isActive ? 'var(--accent)' : 'var(--text-caption)',
    fontSize: 11,
    fontWeight: isActive ? 600 : 500,
    cursor: 'pointer',
    borderRadius: 12,
    minWidth: 0,
  });

  const modalBg = highContrast ? '#0f0f0f' : 'var(--bg-card)';
  const modalBorder = highContrast ? '2px solid #ffc107' : '1px solid var(--divider)';
  const textColor = highContrast ? '#ffffff' : 'var(--text-primary)';
  const secondaryColor = highContrast ? '#94a3b8' : 'var(--text-secondary)';
  const rowHover = highContrast ? '#333' : 'var(--bg-subtle)';

  const writeHref =
    writePlaceSlug && writePlaceSlug !== 'all' ? `/write?place=${encodeURIComponent(writePlaceSlug)}` : '/write';

  return (
    <>
      <nav
        className="bottom-tab-nav"
        role="navigation"
        aria-label="하단 메뉴"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: 480,
          margin: '0 auto',
          zIndex: 40,
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--divider)',
        }}
      >
        {showWriteFab && (
          <Link
            href={writeHref}
            aria-label={t('newLogFabAria')}
            style={{
              position: 'absolute',
              right: 12,
              top: -52,
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'var(--accent)',
              color: 'var(--bg-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-card)',
              zIndex: 41,
            }}
          >
            <Plus size={26} strokeWidth={2} aria-hidden />
          </Link>
        )}
        <button
          type="button"
          className="bottom-tab-btn"
          onClick={() => onTabChange('home')}
          aria-current={activeTab === 'home' ? 'true' : undefined}
          style={tabStyle(activeTab === 'home')}
        >
          <Home size={ICON_SIZE} strokeWidth={STROKE} aria-hidden />
          홈
        </button>
        <button
          type="button"
          className="bottom-tab-btn"
          onClick={() => onTabChange('calendar')}
          aria-current={activeTab === 'calendar' ? 'true' : undefined}
          style={tabStyle(activeTab === 'calendar')}
        >
          <Calendar size={ICON_SIZE} strokeWidth={STROKE} aria-hidden />
          캘린더
        </button>
        <button
          type="button"
          className="bottom-tab-btn"
          onClick={() => onTabChange('search')}
          aria-current={activeTab === 'search' ? 'true' : undefined}
          style={tabStyle(activeTab === 'search')}
        >
          <Search size={ICON_SIZE} strokeWidth={STROKE} aria-hidden />
          검색
        </button>
        <button
          type="button"
          className="bottom-tab-btn"
          onClick={() => onTabChange('todo')}
          aria-current={activeTab === 'todo' ? 'true' : undefined}
          style={tabStyle(activeTab === 'todo')}
        >
          <CheckSquare2 size={ICON_SIZE} strokeWidth={STROKE} aria-hidden />
          할 일
        </button>
        <button
          type="button"
          className="bottom-tab-btn"
          onClick={openSettings}
          aria-label="설정 메뉴"
          style={tabStyle(false)}
        >
          <Settings size={ICON_SIZE} strokeWidth={STROKE} aria-hidden />
          설정
        </button>
      </nav>

      {settingsOpen && (
        <>
          <div
            role="presentation"
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }}
            onClick={() => setSettingsOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-label={t('menu')}
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(360px, 92vw)',
              maxHeight: '80vh',
              overflow: 'auto',
              padding: 20,
              borderRadius: 16,
              background: modalBg,
              border: modalBorder,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              zIndex: 51,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: textColor }}>설정</h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                aria-label={t('close')}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: 'none',
                  background: rowHover,
                  color: secondaryColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={20} strokeWidth={1.5} aria-hidden />
              </button>
            </div>

            <section style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: secondaryColor, marginBottom: 8 }}>
                {t('settingsPersonal')}
              </div>
              <button
                type="button"
                onClick={() => closeAnd(onNameEdit)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '12px 14px',
                  border: 'none',
                  background: 'none',
                  color: textColor,
                  fontSize: 15,
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: 10,
                }}
              >
                · {t('editName')}
              </button>
              <button
                type="button"
                onClick={() => closeAnd(onProfilePhotoChange)}
                disabled={profileAvatarUploading}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '12px 14px',
                  border: 'none',
                  background: 'none',
                  color: textColor,
                  fontSize: 15,
                  textAlign: 'left',
                  cursor: profileAvatarUploading ? 'wait' : 'pointer',
                  borderRadius: 10,
                }}
              >
                · {profileAvatarUploading ? '업로드 중...' : t('profilePhotoChange')}
              </button>
            </section>

            <section style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: secondaryColor, marginBottom: 8 }}>
                {t('settingsFamily')}
              </div>
              <button
                type="button"
                onClick={() => closeAnd(onInviteFamily)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '12px 14px',
                  border: 'none',
                  background: 'none',
                  color: textColor,
                  fontSize: 15,
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: 10,
                }}
              >
                · {t('inviteFamily')}
              </button>
            </section>

            <section>
              <div style={{ fontSize: 12, fontWeight: 600, color: secondaryColor, marginBottom: 8 }}>
                {t('settingsApp')}
              </div>
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 13, color: secondaryColor, marginBottom: 6, paddingLeft: 14 }}>
                  {t('languageChange')}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 14, alignItems: 'stretch' }}>
                  {(['ko', 'en', 'ja', 'zh'] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      className="settings-lang-btn log-filter-btn"
                      onClick={() => setLanguage(lang)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: '1px solid var(--divider)',
                        background: language === lang ? 'var(--accent-light)' : 'transparent',
                        color: textColor,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box',
                        margin: 0,
                        verticalAlign: 'middle',
                      }}
                    >
                      {langLabels[lang]}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => closeAnd(onAccessibility)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '12px 14px',
                  border: 'none',
                  background: 'none',
                  color: textColor,
                  fontSize: 15,
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: 10,
                }}
              >
                · {t('accessibility')}
              </button>
            </section>
          </div>
        </>
      )}
    </>
  );
}
