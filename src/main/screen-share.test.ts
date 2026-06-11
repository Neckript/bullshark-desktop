import { describe, expect, test } from 'vitest';
import { toSourceDto, pickSourceById } from './screen-share';

const img = (url: string, empty = false) => ({ isEmpty: () => empty, toDataURL: () => url });

describe('toSourceDto', () => {
  test('maps id, name and thumbnail data url', () => {
    const dto = toSourceDto({ id: 'screen:0', name: 'Screen 1', thumbnail: img('data:thumb') });
    expect(dto).toEqual({ id: 'screen:0', name: 'Screen 1', thumbnailDataUrl: 'data:thumb' });
  });
  test('includes appIconDataUrl when the app icon is non-empty', () => {
    const dto = toSourceDto({ id: 'win:1', name: 'App', thumbnail: img('data:t'), appIcon: img('data:icon') });
    expect(dto.appIconDataUrl).toBe('data:icon');
  });
  test('omits appIconDataUrl when the app icon is empty or absent', () => {
    expect(toSourceDto({ id: 'a', name: 'a', thumbnail: img('t'), appIcon: img('x', true) }).appIconDataUrl).toBeUndefined();
    expect(toSourceDto({ id: 'b', name: 'b', thumbnail: img('t'), appIcon: null }).appIconDataUrl).toBeUndefined();
    expect(toSourceDto({ id: 'c', name: 'c', thumbnail: img('t') }).appIconDataUrl).toBeUndefined();
  });
});

describe('pickSourceById', () => {
  test('returns the matching source', () => {
    const list = [{ id: 'a' }, { id: 'b' }];
    expect(pickSourceById(list, 'b')).toEqual({ id: 'b' });
  });
  test('returns undefined for an unknown id', () => {
    expect(pickSourceById([{ id: 'a' }], 'z')).toBeUndefined();
  });
});
