import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/apiClient';

export function useContacts(user) {
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const fetchContacts = useCallback(async (options = {}) => {
        if (!user) return;
        const silent = options.silent === true;
        if (!silent) setLoading(true);
        try {
            const data = await apiClient('/api/contacts');
            setContacts(data);
        } catch (err) {
            console.error('Ошибка загрузки контактов:', err);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [user]);

const addContact = useCallback(async (contactId) => {
    try {
        const newContact = await apiClient('/api/contacts', {
            method: 'POST',
            body: JSON.stringify({ contactId }),
        });
        setContacts(prev => {
            const without = prev.filter(c => c.id !== newContact.id);
            return [...without, { ...newContact, hidden: false }];
        });
        return newContact;
    } catch (err) {
        console.error('Ошибка добавления контакта:', err);
        throw err;
    }
}, []);

    const removeContact = useCallback(async (contactId) => {
        try {
            await apiClient(`/api/contacts/${contactId}`, {
                method: 'DELETE',
            });
            setContacts(prev => prev.map((c) => (
                c.id === contactId ? { ...c, hidden: true } : c
            )));
        } catch (err) {
            console.error('Ошибка удаления контакта:', err);
            throw err;
        }
    }, []);

    const unhideContact = useCallback(async (contactId) => {
        try {
            await apiClient(`/api/contacts/${contactId}/unhide`, {
                method: 'PATCH',
            });
            setContacts(prev => prev.map((c) => (
                c.id === contactId ? { ...c, hidden: false } : c
            )));
        } catch (err) {
            console.error('Ошибка возврата контакта:', err);
            throw err;
        }
    }, []);

    const searchUsers = useCallback(async (query) => {
        if (!query || query.length < 2) return [];
        try {
            const data = await apiClient(`/api/contacts/search?query=${encodeURIComponent(query)}`);
            return data;
        } catch (err) {
            console.error('Ошибка поиска:', err);
            return [];
        }
    }, []);

    const clearContacts = useCallback(() => {
        setContacts([]);
        setLoading(true);
    }, []);

    useEffect(() => {
        fetchContacts();
    }, [fetchContacts]);

    return { contacts, loading, fetchContacts, addContact, removeContact, unhideContact, searchUsers, setContacts, clearContacts };
}