import React from 'react';
import Cleave from 'cleave.js/dist/cleave-react.min.js';

export default function CurrencyInput({ value, onChange, ...props }) {
  return (
    <Cleave
      {...props}
      value={value}
      options={{
        numeral: true,
        numeralThousandsGroupStyle: 'thousand',
        numeralDecimalMark: ',',
        delimiter: '.',
        numeralDecimalScale: 2,
      }}
      onChange={onChange}
      className={props.className || 'input-field w-full'}
    />
  );
}
