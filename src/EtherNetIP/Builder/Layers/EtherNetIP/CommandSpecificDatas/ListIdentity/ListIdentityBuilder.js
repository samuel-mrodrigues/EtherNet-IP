/**
 * O Command Specific Data ListIdentity retorna as informações de identidade do dispositivo, como endereço IP, nome, fabricante, numero serial, etc...
 */

import { TraceLog } from "../../../../../Utils/TraceLog.js";

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
                descricao: '',
            },
            /**
             * O tracer log contém as etapas da geração do Buffer
             * @type {TraceLog}
             */
            tracer: new TraceLog()
        }

        retBuff.isSucesso = true;
        retBuff.sucesso.buffer = Buffer.alloc(0);

        retBuff.tracer.addTipo('ListIdentity').add(`Criado um Buffer com 0 bytes já que ListIdentity não necessita de enviar qualquer bytes pro Command Specific Data.`).add(`Builder ListEntity finalizado.`);

        return retBuff;
    }
}