'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Search, Plus, CheckSquare2, Wallet } from 'lucide-react';

export type TabId = 'home' | 'calendar' | 'search' | 'todo' | 'ledger';

type BottomTabBarProps = {
  activeTab: TabId;
  onTabChange: (id: TabId) => void;
  t: (key: string) => string;
  /** 홈에서 태그 선택 후 새 글 작성 시, 선택한 로그 태그(DB `place_slug`)를 미리 채우기 */
  writePlaceSlug?: string | null;
};

const ICON_SIZE = 18;
const STROKE = 1.5;

export function BottomTabBar({ activeTab, onTabChange, t, writePlaceSlug = null }: BottomTabBarProps) {
  const pathname = usePathname();
  const showWriteFab = pathname !== '/write';

  const tabStyle = (isActive: boolean) => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    padding: '6px 2px',
    border: 'none',
    background: isActive ? 'var(--accent-light)' : 'transparent',
    color: isActive ? 'var(--accent)' : 'var(--text-caption)',
    fontSize: 10,
    fontWeight: isActive ? 600 : 500,
    cursor: 'pointer',
    borderRadius: 12,
    minWidth: 0,
  });

  const writeHref =
    writePlaceSlug && writePlaceSlug !== 'all' ? `/write?place=${encodeURIComponent(writePlaceSlug)}` : '/write';

  return (
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
        onClick={() => onTabChange('ledger')}
        aria-current={activeTab === 'ledger' ? 'true' : undefined}
        style={tabStyle(activeTab === 'ledger')}
      >
        <Wallet size={ICON_SIZE} strokeWidth={STROKE} aria-hidden />
        가계부
      </button>
    </nav>
  );
}
