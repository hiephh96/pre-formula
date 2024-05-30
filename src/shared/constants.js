export const OPERATOR = [
  {value: "<>"},
  {value: ">="},
  {value: "<="},
  {value: ">"},
  {value: "<"},
  {value: "="},
  {value: "+"},
  {value: "&"},
  {value: "-"},
  {value: "*"},
  {value: "/"},
  {value: "^"},
  {value: "IS"},
  {value: "LIKE"},
  {value: "ILIKE"},
  {value: "NOT ILIKE"},
  {value: "NOT LIKE"},
];

export const AGGREGATION = [
  {value: "GROWTH"},
  {value: "GROWBY"},
  {value: "AVERAG"},
  {value: "AVG"},
  {value: "COUNTD"},
  {value: "COUNT"},
  {value: "SUM"},
];

export const METRICS = [
  {id: "abcxyz", name: "Metric X Full Name"},
  {id: "xyzqwe", name: "Internet sales"},
  {id: "asdfgh", name: "Metric A"},
  {id: "addert", name: "Metric B"},
  {id: "amamama", name: "AA"},
];

export const DIMENSIONS = [
  {id: "test::Sales::Amount", name: "Sales Amount"},
  {id: "test::Sales::Date", name: "Sales Date"},
  {id: "test::Sales::Date1", name: "Sales Date 1"},
  {id: "test::Sales::Date2", name: "Sales Date 2"},
  {id: "test::Sales::Date3", name: "Sales Date 3"},
];

console.log(OPERATOR.map(op => op.value).sort((a, b) => a < b ? 1 : -1));
