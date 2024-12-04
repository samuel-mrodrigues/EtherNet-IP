import { TraceLog } from "../../../../../../../../Utils/TraceLog.js"
import { hexDeBuffer, numeroToHex } from "../../../../../../../../Utils/Utils.js";
import { PCCCCommandDataBuilder } from "./CommandData/CommandData.js";

/**
 * O layer PCCC Builder permite a customização do serviço de CIP PCCC para um dispositivo que suporte o serviço.
 */
export class CIPPCCCBuilder {
    #campos = {
        /**
        * Request Path é o caminho do que foi solicitado ao dispositivo. O CIP PCCC é a classe 0x067 instancia unica 1
        */
        requestPath: {
            /**
             * @type {Buffer}
             */
            classe: undefined,
            /**
             * @type {Buffer}
             */
            instancia: undefined
        },
        /**
         * O código da função PCCC solicitado
         * @type {Number}
         */
        servicopccc: undefined,
        /**
         * Informações para enviar no Requestor(aparentemente pro dispositivo que vai receber saber)
         */
        requestorCampos: {
            /**
             * O ID do dispositivo que ta enviando(você)
             * @type {Buffer}
             */
            vendorID: undefined,
            /**
             * O serial number do dispositivo que ta enviando(você)
             * @type {Buffer}
             */
            serialNumber: undefined
        },
        /**
         * O payload do PCCC Command Data, que contém detalhes da ação solicitada
         * @type {PCCCCommandDataBuilder}
         */
        commandDataBuilder: undefined
    }

    constructor() {
        const valoresPadroes = {
            requestPath: (classe, instancia) => {
                if (classe) {
                    this.#campos.requestPath.classe = Buffer.from([0x20, 0x067]);
                }

                if (instancia) {
                    this.#campos.requestPath.instancia = Buffer.from([0x24, 0x01])
                }
            },
            requestor: (vendor, serial) => {
                if (vendor) {
                    this.#campos.requestorCampos.vendorID = Buffer.from([0x00, 0x00]);
                }

                if (serial) {
                    this.#campos.requestorCampos.serialNumber = Buffer.from([0x01, 0x02, 0x03, 0x04]);
                }
            }
        }

        // Setar os valores padrões pro Request Path
        valoresPadroes.requestPath(true, true);

        // Setar o Requestor
        valoresPadroes.requestor(true, true);
    }

    /**
     * Seta o código de serviço PCCC que deverá ser executado.
     */
    setServicePCCC(codigoServico) {
        if (getServicoPCCC(codigoServico) == undefined) throw new Error(`O código de serviço PCCC ${codigoServico} não é válido`);

        this.#campos.servicopccc = codigoServico;

        return this;
    }

    /**
     * Retorna o PCC Command Data para configurar nessa solicitação CIP
     */
    getCommandData() {
        if (this.#campos.commandDataBuilder == undefined) {
            this.#campos.commandDataBuilder = new PCCCCommandDataBuilder();
        }

        return this.#campos.commandDataBuilder;
    }

    /**
     * Cripar o Buffer CIP PCCC
     */
    criarBuffer() {
        const retBuff = {
            isSucesso: false,
            sucesso: {
                /**
                 * O Buffer com os dados do CIP Connection Manager
                 * @type {Buffer}
                 */
                buffer: undefined
            },
            erro: {
                descricao: ''
            },
            /**
             * O tracer de logs contém as etapas da geração do buffer.
             * @type {TraceLog}
             */
            tracer: new TraceLog()
        }

        const tracerBuffer = retBuff.tracer.addTipo(`CIP PCCC Builder`);

        tracerBuffer.add(`Iniciando a criação do buffer do CIP PCCC`);

        if (this.#campos.servicopccc == undefined) {
            retBuff.erro.descricao = `O código do serviço PCCC não foi configurado. Use setServicePCCC() para configurar o serviço PCCC`;

            tracerBuffer.add(`O código do serviço PCCC não foi configurado, não é possível continuar.`);

            return retBuff;
        }

        // Alocar 6 bytes pro cabeçalho do serviço cabeçalho CIP
        const bufferCabecalho = Buffer.alloc(6);

        tracerBuffer.add(`Criando um Buffer de ${bufferCabecalho.length} bytes para o cabeçalho do CIP PCCC`);

        // Primeiro 1 byte é oodigo do serviço
        bufferCabecalho.writeUInt8(this.#campos.servicopccc, 0);
        tracerBuffer.add(`Setando o campo codigo de serviço para ${this.#campos.servicopccc} (${numeroToHex(this.#campos.servicopccc, 1)}) no offset 0`);

        const tamanhoRequestPath = Math.ceil((this.#campos.requestPath.classe.length + this.#campos.requestPath.instancia.length) / 2)
        // Próximo 1 byte é o tamanho do Request Path(nesse caso é o CIP PCCC)
        bufferCabecalho.writeUInt8(tamanhoRequestPath, 1);
        tracerBuffer.add(`Setando o tamanho do Request Path para ${tamanhoRequestPath} WORDs no offset 1`);

        // 2 Bytes da Classe
        this.#campos.requestPath.classe.copy(bufferCabecalho, 2);
        tracerBuffer.add(`Setando a classe do Request Path para (${hexDeBuffer(this.#campos.requestPath.classe)}) no offset 2`);

        // 2 Bytes da Instancia
        this.#campos.requestPath.instancia.copy(bufferCabecalho, 4);
        tracerBuffer.add(`Setando a instancia do Request Path para (${hexDeBuffer(this.#campos.requestPath.instancia)}) no offset 4`);

        tracerBuffer.add(`Buffer de cabeçalho CIP gerado com sucesso: ${hexDeBuffer(bufferCabecalho)}. Total de ${bufferCabecalho.length} bytes`);

        // Com o cabeçalho CIP apontando pro CIP PCCC, gerar o Buffer do Requestor ID
        // 7 Bytes(1 byte Requestor ID Length, 2 bytes CIP Vendor ID e 4 bytes CIP Serial Number) = Requestor ID, que é pra descrever quem ta solicitando essa requisição, é só preencher com campos genericos
        const bufferRequestorID = Buffer.alloc(7);
        tracerBuffer.add(`Criando um Buffer de ${bufferRequestorID.length} bytes para Requestor ID`);

        // 1 Byte é o tamanho do Requestor ID (tamanho dos que compoe o Requestor ID). No momento como vou fixar os IDS vai ser 7
        bufferRequestorID.writeUInt8(0x07, 0);
        tracerBuffer.add(`Setando o campo Requestor ID Length para 0x07 no offset 1`);

        // 2 Bytes é o CIP Vendor ID(No Wireshark é 0x0000)
        bufferRequestorID.writeUInt16LE(0x0000, 1);
        tracerBuffer.add(`Setando o campo CIP Vendor ID para 0x0000 no offset 2`);

        // 4 Bytes é o CIP Serial Number(No wiresharkta como generico 1234)
        bufferRequestorID.writeUInt32LE(0x04030201, 3);
        tracerBuffer.add(`Setando o campo CIP Serial Number para 0x04030201 no offset 4`);

        tracerBuffer.add(`Buffer de Requestor ID gerado com sucesso: ${hexDeBuffer(bufferRequestorID)}. Total de ${bufferRequestorID.length} bytes`);

        tracerBuffer.add(`Iniciando a criação do buffer do PCCC Command Data`);

        // Se não foi configurado o Command Data
        if (this.#campos.commandDataBuilder == undefined) {
            retBuff.erro.descricao = `O Command Data não foi configurado. Use getCommandData() para configurar o Command Data`;

            tracerBuffer.add(`O Command Data não foi configurado, não é possível continuar.`);

            return retBuff;
        }

        // Criar o buffer do Command Data
        let statusGeraBufferPCCCommandData = this.#campos.commandDataBuilder.criarBuffer();

        retBuff.tracer.appendTraceLog(statusGeraBufferPCCCommandData.tracer);
        if (!statusGeraBufferPCCCommandData.isSucesso) {
            retBuff.erro.descricao = `Erro ao gerar o buffer do PCCC Command Data: ${statusGeraBufferPCCCommandData.erro.descricao}`;

            tracerBuffer.add(`Erro ao gerar o buffer do PCCC Command Data: ${statusGeraBufferPCCCommandData.erro.descricao}`);
            return retBuff;
        }

        // Se gerou com sucesso, juntar no buffer final com os outros buffers

        const bufferFinal = Buffer.concat([bufferCabecalho, bufferRequestorID, statusGeraBufferPCCCommandData.sucesso.buffer]);

        tracerBuffer.add(`Builder CIP PCCC finalizado.`);

        retBuff.isSucesso = true;
        retBuff.sucesso.buffer = bufferFinal;
        return retBuff;
    }

    /**
     * Retorna os tipos de serviços PCCC disponíveis pra solicitar
     */
    getServicesPCCC() {
        return ServicosPCCC;
    }
}


export const ServicosPCCC = {
    ExecutePCCC: {
        hex: 0x4B,
        descricao: 'Execute PCCC'
    }
}

export function getServicoPCCC(cod) {
    return Object.values(ServicosPCCC).find(servico => servico.hex === cod);
}