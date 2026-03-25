import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { ColumnDef } from '../types/tableColumns';

export function useTableColumns(defs: ColumnDef[], containerWidth: number) {
  const [columnOrder, setColumnOrder] = useState<string[]>(() => defs.map(d => d.key));
  const [columnWidths, setColumnWidths] = useState<Map<string, number>>(new Map());
  const [resizingKey, setResizingKey] = useState<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const resizeRef = useRef<{ key: string; startX: number; startWidth: number; nextKey: string | null; nextStartWidth: number } | null>(null);
  const dragRef = useRef<{ key: string; startX: number; headerLeft: number } | null>(null);
  const widthsRef = useRef<Map<string, number>>(columnWidths);
  const orderRef = useRef<string[]>(columnOrder);
  const rafRef = useRef<number | null>(null);
  const headerElRef = useRef<HTMLElement | null>(null);

  widthsRef.current = columnWidths;
  orderRef.current = columnOrder;

  useEffect(() => {
    const defKeys = defs.map(d => d.key);
    setColumnOrder(prev => {
      const existing = prev.filter(k => defKeys.includes(k));
      const newKeys = defKeys.filter(k => !prev.includes(k));
      return [...existing, ...newKeys];
    });
  }, [defs.map(d => d.key).join(',')]);

  useEffect(() => {
    if (containerWidth <= 0) return;

    const fixedTotal = defs.reduce((sum, d) => sum + (d.fixedWidth || 0), 0);
    const available = containerWidth - fixedTotal;
    const totalFlex = defs.reduce((sum, d) => sum + (d.fixedWidth ? 0 : d.defaultFlex), 0);

    const newWidths = new Map<string, number>();
    for (const def of defs) {
      if (def.fixedWidth) {
        newWidths.set(def.key, def.fixedWidth);
      } else {
        const w = totalFlex > 0 ? (def.defaultFlex / totalFlex) * available : 100;
        newWidths.set(def.key, Math.max(w, def.minWidth));
      }
    }
    setColumnWidths(newWidths);
  }, [containerWidth, defs.map(d => `${d.key}:${d.defaultFlex}:${d.fixedWidth}`).join(',')]);

  const getColumnWidth = useCallback((key: string): number => {
    return widthsRef.current.get(key) || 100;
  }, []);

  const getDefByKey = useCallback((key: string) => defs.find(d => d.key === key), [defs]);

  const setHeaderRef = useCallback((ref: any) => {
    if (Platform.OS === 'web' && ref) {
      headerElRef.current = ref;
    }
  }, []);

  const onResizeStart = useCallback((key: string, e: any) => {
    if (Platform.OS !== 'web') return;
    e.preventDefault?.();

    const order = orderRef.current;
    const idx = order.indexOf(key);
    const nextKey = idx < order.length - 1 ? order[idx + 1] : null;

    resizeRef.current = {
      key,
      startX: e.clientX ?? e.nativeEvent?.pageX ?? 0,
      startWidth: widthsRef.current.get(key) || 100,
      nextKey,
      nextStartWidth: nextKey ? (widthsRef.current.get(nextKey) || 100) : 0,
    };
    setResizingKey(key);

    const handleMove = (ev: PointerEvent) => {
      if (!resizeRef.current) return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const ref = resizeRef.current!;
        const delta = ev.clientX - ref.startX;
        const def = getDefByKey(ref.key);
        const nextDef = ref.nextKey ? getDefByKey(ref.nextKey) : null;

        let newWidth = ref.startWidth + delta;
        let newNextWidth = ref.nextStartWidth - delta;

        if (def && newWidth < def.minWidth) {
          newWidth = def.minWidth;
          newNextWidth = ref.nextStartWidth + (ref.startWidth - def.minWidth);
        }
        if (nextDef && newNextWidth < nextDef.minWidth) {
          newNextWidth = nextDef.minWidth;
          newWidth = ref.startWidth + (ref.nextStartWidth - nextDef.minWidth);
        }

        setColumnWidths(prev => {
          const next = new Map(prev);
          next.set(ref.key, newWidth);
          if (ref.nextKey) next.set(ref.nextKey, newNextWidth);
          return next;
        });
      });
    };

    const handleUp = () => {
      resizeRef.current = null;
      setResizingKey(null);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  }, [getDefByKey]);

  const onDragStart = useCallback((key: string, e: any) => {
    if (Platform.OS !== 'web') return;
    e.preventDefault?.();

    let headerLeft = 0;
    if (headerElRef.current) {
      const el = headerElRef.current as any;
      if (el.getBoundingClientRect) {
        headerLeft = el.getBoundingClientRect().left;
      } else if (el.measure) {
        el.measure((_x: number, _y: number, _w: number, _h: number, pageX: number) => {
          headerLeft = pageX;
        });
      }
    }

    dragRef.current = {
      key,
      startX: e.clientX ?? e.nativeEvent?.pageX ?? 0,
      headerLeft,
    };
    setDraggingKey(key);

    const handleMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const order = orderRef.current;
      const widths = widthsRef.current;
      const relX = ev.clientX - dragRef.current.headerLeft;

      let cumX = 0;
      let overKey: string | null = null;
      for (const k of order) {
        const w = widths.get(k) || 100;
        if (relX >= cumX && relX < cumX + w) {
          overKey = k;
          break;
        }
        cumX += w;
      }
      if (!overKey && order.length > 0) {
        overKey = order[order.length - 1];
      }

      if (overKey && overKey !== dragRef.current.key) {
        setDragOverKey(overKey);
      } else {
        setDragOverKey(null);
      }
    };

    const handleUp = () => {
      if (dragRef.current) {
        const fromKey = dragRef.current.key;
        setDragOverKey(current => {
          if (current && current !== fromKey) {
            setColumnOrder(prev => {
              const newOrder = [...prev];
              const fromIdx = newOrder.indexOf(fromKey);
              const toIdx = newOrder.indexOf(current);
              if (fromIdx !== -1 && toIdx !== -1) {
                [newOrder[fromIdx], newOrder[toIdx]] = [newOrder[toIdx], newOrder[fromIdx]];
              }
              return newOrder;
            });
          }
          return null;
        });
      }
      dragRef.current = null;
      setDraggingKey(null);
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  }, []);

  return {
    columnOrder,
    columnWidths,
    getColumnWidth,
    onResizeStart,
    onDragStart,
    resizingKey,
    draggingKey,
    dragOverKey,
    setHeaderRef,
  };
}
