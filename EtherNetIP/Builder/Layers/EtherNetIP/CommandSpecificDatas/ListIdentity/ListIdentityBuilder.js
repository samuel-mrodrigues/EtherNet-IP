/**
 * O Command Specific Data ListIdentity retorna as informações de identidade do dispositivo, como endereço IP, nome, fabricante, numero serial, etc...
 */

/**
 * Monta o Command Specific Data ListIdentity
 ** Até o momento, não precisa enviar nada no Command Specific Data para listar a identidade.
 */
export class CommandSpecificDataListEntityBuilder {

    /**
     * Instanciar o construtor.
     */
    constructor() {

    }

    /**
     * Construi um buffer para ser enviado no Command Specific Data. Atualmente, o ListIdentity não precisa enviar nada, então é retornado um buffer vazio
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