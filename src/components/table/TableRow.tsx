import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';

interface TableRowProps {
  columnOrder: string[];
  getColumnWidth: (key: string) => number;
  renderCell: (key: string, width: number) => React.ReactNode;
  style?: any;
  onPress?: () => void;
  activeOpacity?: number;
}

export function TableRow({
  columnOrder,
  getColumnWidth,
  renderCell,
  style,
  onPress,
  activeOpacity = 0.7,
}: TableRowProps) {
  const DIVIDER_WIDTH = 12;
  const cells = columnOrder.map((key, idx) => {
    const rawWidth = getColumnWidth(key);
    const isLast = idx === columnOrder.length - 1;
    const width = isLast ? rawWidth : rawWidth - DIVIDER_WIDTH;
    return (
      <React.Fragment key={key}>
        <View style={[styles.cell, { width }]}>
          {renderCell(key, width)}
        </View>
        {!isLast && <View style={{ width: DIVIDER_WIDTH }} />}
      </React.Fragment>
    );
  });

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={activeOpacity} style={[styles.row, style]}>
        {cells}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.row, style]}>
      {cells}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  cell: {
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
});
