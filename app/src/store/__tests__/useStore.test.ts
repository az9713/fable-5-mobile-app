import { useStore } from '@/store/useStore';
import { BACKGROUNDS } from '@/theme/backgrounds';

describe('useStore', () => {
  it('initializes with defaults', () => {
    const state = useStore.getState();

    expect(state.folders).toEqual([]);
    expect(state.notes).toEqual([]);
    expect(state.selectedFolderId).toBeNull();
    expect(state.selectedBackgroundId).toBe(BACKGROUNDS[0]?.id);
  });

  it('setSelectedBackgroundId updates state', () => {
    useStore.getState().setSelectedBackgroundId('monet');
    expect(useStore.getState().selectedBackgroundId).toBe('monet');
  });
});
