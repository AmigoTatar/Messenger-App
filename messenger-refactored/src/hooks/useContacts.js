import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/apiClient';

export function useContacts(user) {
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
console.log('📤 [useContacts] contacts после загрузки:', contacts);
    const fetchContacts = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await apiClient('/api/contacts');
            setContacts(data);
        } catch (err) {
            console.error('Ошибка загрузки контактов:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

const addContact = useCallback(async (contactId) => {
    try {
        const newContact = await apiClient('/api/contacts', {
            method: 'POST',
            body: JSON.stringify({ contactId }),
        });
        setContacts(prev => {
            if (prev.some(c => c.id === newContact.id)) return prev;
            return [...prev, newContact];
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
            setContacts(prev => prev.filter(c => c.id !== contactId));
        } catch (err) {
            console.error('Ошибка удаления контакта:', err);
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

    return { contacts, loading, fetchContacts, addContact, removeContact, searchUsers, setContacts, clearContacts };
}