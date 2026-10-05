import { useCallback, useEffect, useState } from 'react';

// Carga datos del panel con estados de carga y error, y permite recargarlos tras un cambio
export function useCarga(fetcher) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    return fetcher()
      .then((data) => setState({ data, loading: false, error: '' }))
      .catch((err) => setState((prev) => ({ ...prev, loading: false, error: err.message })));
  }, [fetcher]);

  useEffect(() => {
    let active = true;
    fetcher()
      .then((data) => { if (active) setState({ data, loading: false, error: '' }); })
      .catch((err) => { if (active) setState({ data: null, loading: false, error: err.message }); });
    return () => { active = false; };
  }, [fetcher]);

  return { ...state, reload };
}
