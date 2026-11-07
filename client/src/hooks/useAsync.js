import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../utils/format';

/**
 * Run an async loader and track its state.
 *   const { data, loading, error, reload, setData } = useAsync(() => getThing(id), [id]);
 * The loader should resolve to an axios response; `data` is `response.data` by default.
 * Stale responses (from an older call) are ignored, so fast filter changes never
 * show out-of-order results.
 */
export default function useAsync(loader, deps = [], { select = (res) => res.data, immediate = true } = {}) {
  const [state, setState] = useState({ data: null, loading: immediate, error: null });
  const callId = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const selectRef = useRef(select);
  selectRef.current = select;

  const run = useCallback(async ({ silent = false } = {}) => {
    const id = ++callId.current;
    setState((s) => ({ ...s, loading: !silent || s.data === null, error: null }));
    try {
      const res = await loaderRef.current();
      if (id === callId.current) setState({ data: selectRef.current(res), loading: false, error: null });
      return res;
    } catch (err) {
      if (id === callId.current) setState((s) => ({ ...s, loading: false, error: errorMessage(err, 'Failed to load data') }));
      return null;
    }
  }, []);

  useEffect(() => {
    if (immediate) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);

  return { ...state, reload: run, refresh: () => run({ silent: true }), setData };
}
