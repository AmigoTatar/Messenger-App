// src/contexts/MessageContext.js
import { createContext, useContext } from 'react';

export const MessageContext = createContext(null);

export const useMessage = () => {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error('useMessage must be used within MessageProvider');
  }
  return context;
};