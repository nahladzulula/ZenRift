/**
 * Orquestación de datos con caché, validación y operaciones CRUD
 */

const crypto = require('crypto');

class ZenRiftService {
    constructor() {
        // --- Base de datos en memoria (simulada) ---
        this.items = [];
        
        // --- Caché funcional con TTL (Time-To-Live) ---
        this.cache = new Map(); // clave -> { value, expiresAt }

        // --- Datos de ejemplo para arrancar ---
        this._seedInitialData();

        // Tiempo de vida predeterminado de la caché: 30 segundos
        this.DEFAULT_CACHE_TTL_MS = 30000;
    }

    // -------------------- DATOS INICIALES (SEMILLA) --------------------
    _seedInitialData() {
        const seedItems = [
            { id: '1', name: 'Gateway Alpha', status: 'active', priority: 1 },
            { id: '2', name: 'Gateway Beta', status: 'idle', priority: 2 },
            { id: '3', name: 'Engine Gamma', status: 'processing', priority: 1 },
        ];
        this.items.push(...seedItems);
    }

    // -------------------- UTILIDADES INTERNAS --------------------
    _generateId() {
        return crypto.randomUUID(); // Genera UUIDs únicos (Node.js nativo)
    }

    _validateItemData(data, isUpdate = false) {
        const errors = [];

        if (!isUpdate || data.name !== undefined) {
            if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
                errors.push('El campo "name" es obligatorio y debe ser un texto no vacío.');
            }
        }

        if (!isUpdate || data.status !== undefined) {
            const validStatuses = ['active', 'idle', 'processing', 'error', 'stopped'];
            if (data.status && !validStatuses.includes(data.status)) {
                errors.push(`El campo "status" debe ser uno de: ${validStatuses.join(', ')}.`);
            }
        }

        if (!isUpdate || data.priority !== undefined) {
            if (data.priority !== undefined && (typeof data.priority !== 'number' || data.priority < 0 || data.priority > 10)) {
                errors.push('El campo "priority" debe ser un número entre 0 y 10.');
            }
        }

        if (errors.length > 0) {
            const error = new Error('Datos inválidos');
            error.details = errors;
            error.code = 'VALIDATION_ERROR';
            throw error;
        }

        // Sanitización: recortar espacios
        const sanitized = { ...data };
        if (sanitized.name) sanitized.name = sanitized.name.trim();
        return sanitized;
    }

    // -------------------- GESTIÓN DE CACHÉ --------------------
    _getFromCache(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key); // Limpiar caché expirado
            return null;
        }
        return entry.value;
    }

    _setCache(key, value, ttlMs = this.DEFAULT_CACHE_TTL_MS) {
        this.cache.set(key, {
            value,
            expiresAt: Date.now() + ttlMs,
        });
    }

    _clearCache() {
        this.cache.clear();
        console.log('[Cache] Caché purgada completamente.');
    }

    // -------------------- MÉTODOS PÚBLICOS (API DEL SERVICIO) --------------------

    /**
     * Obtiene todos los ítems con opción de filtro y caché.
     * @param {Object} filters - Ej: { status: 'active' }
     * @param {boolean} useCache - Si usa la caché o forza consulta directa.
     */
    async getItems(filters = {}, useCache = true) {
        const cacheKey = `items_${JSON.stringify(filters)}`;

        if (useCache) {
            const cached = this._getFromCache(cacheKey);
            if (cached) {
                console.log('[Cache] Hit - Devolviendo items desde caché.');
                return cached;
            }
        }

        // Simular latencia de base de datos (200ms)
        await new Promise(resolve => setTimeout(resolve, 200));

        let result = [...this.items];

        // Aplicar filtros dinámicamente
        if (filters.status) {
            result = result.filter(item => item.status === filters.status);
        }
        if (filters.priority) {
            result = result.filter(item => item.priority === Number(filters.priority));
        }
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            result = result.filter(item =>
                item.name.toLowerCase().includes(searchLower)
            );
        }

        // Ordenar por prioridad (menor número = mayor prioridad)
        result.sort((a, b) => a.priority - b.priority);

        // Guardar en caché (solo si hay filtros definidos, para no saturar)
        if (Object.keys(filters).length > 0) {
            this._setCache(cacheKey, result);
        }

        console.log(`[Service] Devolviendo ${result.length} ítems.`);
        return result;
    }

    /**
     * Obtiene un ítem por su ID.
     */
    async getItemById(id) {
        if (!id) throw new Error('Se requiere un ID válido.');

        // Intentar caché primero
        const cacheKey = `item_${id}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) {
            console.log(`[Cache] Hit - Ítem ${id} desde caché.`);
            return cached;
        }

        // Simular latencia
        await new Promise(resolve => setTimeout(resolve, 100));

        const item = this.items.find(i => i.id === id);
        if (!item) {
            const error = new Error(`Ítem con ID ${id} no encontrado.`);
            error.code = 'NOT_FOUND';
            throw error;
        }

        this._setCache(cacheKey, item);
        return item;
    }

    /**
     * Crea un nuevo ítem.
     */
    async createItem(data) {
        // Validar y sanitizar
        const sanitized = this._validateItemData(data, false);

        const newItem = {
            id: this._generateId(),
            ...sanitized,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        // Simular escritura en DB
        await new Promise(resolve => setTimeout(resolve, 150));
        this.items.push(newItem);

        // Invalidar caché de listados (para que la próxima consulta traiga datos frescos)
        this._clearCache();

        console.log(`[Service] Ítem creado: ${newItem.id}`);
        return newItem;
    }

    /**
     * Actualiza un ítem existente (PATCH parcial).
     */
    async updateItem(id, data) {
        if (!id) throw new Error('Se requiere un ID.');

        const existingIndex = this.items.findIndex(i => i.id === id);
        if (existingIndex === -1) {
            const error = new Error(`Ítem con ID ${id} no encontrado.`);
            error.code = 'NOT_FOUND';
            throw error;
        }

        // Validar solo los campos que vienen en la actualización
        const sanitized = this._validateItemData(data, true);

        // Simular actualización
        await new Promise(resolve => setTimeout(resolve, 150));

        const updatedItem = {
            ...this.items[existingIndex],
            ...sanitized,
            updatedAt: new Date().toISOString(),
        };

        this.items[existingIndex] = updatedItem;

        // Invalidar cachés relacionados
        this._clearCache();

        console.log(`[Service] Ítem ${id} actualizado.`);
        return updatedItem;
    }

    /**
     * Elimina un ítem por su ID.
     */
    async deleteItem(id) {
        if (!id) throw new Error('Se requiere un ID.');

        const existingIndex = this.items.findIndex(i => i.id === id);
        if (existingIndex === -1) {
            const error = new Error(`Ítem con ID ${id} no encontrado.`);
            error.code = 'NOT_FOUND';
            throw error;
        }

        // Simular eliminación
        await new Promise(resolve => setTimeout(resolve, 100));
        this.items.splice(existingIndex, 1);

        // Invalidar caché
        this._clearCache();

        console.log(`[Service] Ítem ${id} eliminado.`);
        return { deleted: true, id };
    }

    /**
     * Método de "procesamiento" mejorado.
     * Ahora orquesta varias tareas (enriquecimiento, validación, etc.)
     */
    async process(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('No se proporcionaron datos válidos para procesar.');
        }

        // 1. Validación de entrada del proceso
        if (!data.action) {
            throw new Error('El campo "action" es requerido (ej: "enrich", "validate", "transform").');
        }

        console.log(`[Process] Iniciando acción: ${data.action}`);

        // 2. Simular pasos de procesamiento asíncrono
        await new Promise(resolve => setTimeout(resolve, 300)); // Simula trabajo pesado

        // 3. Lógica según la acción solicitada
        let resultPayload = {};
        switch (data.action) {
            case 'enrich':
                resultPayload = {
                    ...data.payload,
                    enriched: true,
                    enrichedAt: new Date().toISOString(),
                    metadata: {
                        source: 'ZenRift Engine',
                        version: '2.0.0'
                    }
                };
                break;
            case 'validate':
                const isValid = data.payload && data.payload.id && data.payload.name;
                resultPayload = {
                    ...data.payload,
                    valid: isValid,
                    validationErrors: isValid ? [] : ['Faltan campos obligatorios: id o name']
                };
                break;
            case 'transform':
                resultPayload = {
                    original: data.payload,
                    transformed: {
                        upperCaseName: data.payload?.name?.toUpperCase() || 'N/A',
                        processedAt: new Date().toISOString(),
                        priorityLevel: data.payload?.priority > 5 ? 'HIGH' : 'LOW'
                    }
                };
                break;
            default:
                throw new Error(`Acción "${data.action}" no soportada. Usa: enrich, validate, transform.`);
        }

        // 4. Guardar en caché el resultado del proceso (TTL más corto: 10s)
        const processCacheKey = `process_${data.action}_${Date.now()}`;
        this._setCache(processCacheKey, resultPayload, 10000);

        return {
            processed: true,
            action: data.action,
            timestamp: new Date().toISOString(),
            result: resultPayload
        };
    }

    /**
     * Limpia manualmente la caché (útil para testing o administración).
     */
    async purgeCache() {
        this._clearCache();
        return { purged: true, timestamp: new Date().toISOString() };
    }
}

module.exports = { ZenRiftService };
