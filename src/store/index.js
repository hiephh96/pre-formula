import {createContext, useContext, useRef} from "react";
import {createStore, useStore as useZustandStore} from "zustand";

const createDataStore = (initialData) => createStore((set, get) => ({
  options: initialData,
  suggestionOptions: [],
  updateStore: async (data) => {
    set(data);
  },
}));

const StoreContext = createContext(null);

export const StoreProvider = ({children, ...rest}) => {
  const storeRef = useRef();
  if (!storeRef.current) {
    storeRef.current = createDataStore(rest);
  }

  return (<StoreContext.Provider value={storeRef.current}>
    {children}
  </StoreContext.Provider>);
};

export const useStore = (selector) => {
  const store = useContext(StoreContext);

  if (!store) throw new Error("Missing StoreProvider in the tree");

  return useZustandStore(store, selector);
};
