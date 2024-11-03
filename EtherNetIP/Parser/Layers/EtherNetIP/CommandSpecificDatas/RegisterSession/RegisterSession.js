/**
 * O Register Session possui um Command Specific Data com dois campos
 */

import { TraceLog } from "../../../../../Utils/TraceLog.js";
import { hexDeBuffer, numeroToHex } from "../../../../../Utils/Utils.js";

/**
 * Command Specific Data
 *      Protocol version      (UINT, 2 bytes, unsigned)           // Requested protocol version shall be set to 1
 *      Options flags         (UINT, 2 bytes, unsigned)           // Session options shall be set to 0
 *                                                               // Bits 0-7 are reserved for legacy (RA)
 *                                                               // Bits 8-15 are reserved for future expansion
 *                                                               // NOTE: This field is not the same as the option flags in the encapsulation header
 */

/**
 * Representação dos campos do Command Specific Data do comando Register Session
 */
export class CommandSpecificDataRegisterSession {

    /**
     * Detalhes se o Command Specific Data do comando Register Session é valido
     */
    #statusComando = {
        /**
         * Se está valido com todas as informações necessárias
         */
        isValido: false,
        /**
         * Se não é valido, motivo do erro
         */
        erro: {
            descricao: ''
        },
        /**
         * O tracer contém o passo a passo do parser do buffer
         * @type {TraceLog}
         */
        tracer: undefined
    }

    /**
     * Os campos contidos no Command Specific Data recebido do Buffer
     */
    #campos = {
        /**
         * Versão do protocolo de comunicação, segundo o manual sempre deve ser 1
         */
        protocolVersion: undefined,
        /**
         * Flags de opções da sessão, segundo o manual deve estar tudo como 0 
         */
        optionFlags: undefined
    }

    /**
     * Instanciar o payload do comando de Register Session
     * @param {Buffer} buffer - Opcionamente um buffer para dar parse no conteudo
     */
    constructor(buffer) {
        if (buffer != undefined) this.parseBuffer(buffer);
    }

    /**
     * Passa um Buffer do Command Specific Data do layer EtherNet/IP e faz o parse dos campos
     * @param {Buffer} buff - Buffer com os dados do Command Specific Data
     */
    parseBuffer(buff) {
        let retornoParse = {
            isSucesso: false,
            erro: {
                descricao: ''
            },
            /**
             * O tracer contém o passo a passo do parser do buffer
             */
            tracer: new TraceLog()
        }

        const tracerBuffer = retornoParse.tracer.addTipo(`RegisterSession Parser`);
        this.#statusComando.tracer = retornoParse.tracer;

        tracerBuffer.add(`Iniciando parser de RegisterSession com o Buffer: ${hexDeBuffer(buff)}, ${buff.length} bytes`);

        // O buffer deve ter no minimo 4 bytes.
        if (buff.length < 4) {
            this.#statusComando.isValido = false;
            this.#statusComando.erro.descricao = 'Buffer não contém os 4 bytes minimos do Command Specific Data do comando Register Session';

            retornoParse.erro.descricao = this.#statusComando.erro.descricao;

            tracerBuffer.add(`O Buffer recebido não tem os 4 bytes minimos para o Command Specific Data do comando Register Session`);
            return retornoParse;
        }

        const protocolVersion = buff.readUInt16LE(0);
        tracerBuffer.add(`Lendo a versão do protocolo: ${protocolVersion} (${numeroToHex(protocolVersion, 2)}) no offset 0`);

        const optionFlags = buff.readUInt16LE(2);
        tracerBuffer.add(`Lendo as flags de opções: ${optionFlags} (${numeroToHex(optionFlags, 2)}) no offset 2`);

        this.#campos.protocolVersion = protocolVersion;
        this.#campos.optionFlags = optionFlags;

        this.#statusComando.isValido = true;

        tracerBuffer.add(`Parser de RegisterSession finalizado com sucesso! Versão do protocolo: ${protocolVersion} (${numeroToHex(protocolVersion, 2)}), Flags de opções: ${optionFlags} (${numeroToHex(optionFlags, 2)})`);
        retornoParse.isSucesso = true;
        return retornoParse;
    }

    /**
     * Retorna se o comando esta formatado com todos os campos necessários corretos
     */
    isValido() {
        let retornoOk = {
            isValido: false,
            erro: {
                descricao: ''
            },
            /**
             * O tracer contém o passo a passo do parser do buffer
             */
            tracer: undefined
        }

        // Se algum campo ficou faltando, validar se não é valido
        if (this.#statusComando.isValido) {

            retornoOk.isValido = true;
        } else {
            retornoOk.erro.descricao = this.#statusComando.erro.descricao;
        }
        return retornoOk;
    }

    /**
     * Retorna a versão do protocolo usada no encapsulamento. Deve sempre ser 1 segundo o manual.
     */
    getProtocolVersion() {
        return this.#campos.protocolVersion;
    }

    /**
     * Retorna os bits de flags opcionais setadas da sessão (atualmente não uso pra nada)
     */
    getOptionFlags() {
        return this.#campos.optionFlags;
    }
}