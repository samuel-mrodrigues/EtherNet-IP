/**
 * O Command Specific Data List Services retorna as disponibilidades de comunicação que o dispositivo remoto remoto suporta
 */

/**
 * TargetItems
 *      Item Count           (UINT, 2 bytes, unsigned)            // Number of items to follow
 *      Target Items         (STRUCT)                             // Interface Information
 *          Item Type Code   (UINT, 2 bytes, unsigned)            // Item Type Code
 *          Item Length      (UINT, 2 bytes, unsigned)            // Item Length
 *          Version          (UINT, 2 bytes, unsigned)            // Version of encapsulated protocol shall be set to 1
 *          Capability flags (UINT, 2 bytes, unsigned)            // Capability flags
 *          Name of service  (ARRAY[16] of USINT, 16 bytes)       // Name of service
 */

/**
 * Montagem de um comando Command Specific Data para o tipo de comando ListServices
 */
export class CommandSpecificDataListServicesBuilder {

    /**
     * Instanciar o builder
     */
    constructor() {

    }

    /**
     * Construi um buffer para ser enviado no Command Specific Data. Atualmente, o ListServices não precisa enviar nada, então é retornado um buffer vazio
     */
    criarBuffer() {
        const retBuff = {
            isSucesso: false,
            sucesso: {
                /**
                 * @type {Buffer}
                 */
                buffer: undefined
            },
            erro: {
                descricao: ''
            }
        }

        retBuff.isSucesso = true;
        retBuff.sucesso.buffer = Buffer.alloc(0);

        return retBuff;
    }
}