/**
 * O Command Specific Data ListIdentity retorna as informações de identidade do dispositivo, como endereço IP, nome, fabricante, numero serial, etc...
 */

import { TraceLog } from "../../../../../Utils/TraceLog.js";
import { hexDeBuffer, numeroToHex } from "../../../../../Utils/Utils.js";

// O buffer começa com o estrutura abaixo

/**
 * ListIdentityItems
 *      Item Count           (UINT, 2 bytes, unsigned)            // Number of target items to follow
 *      ListIdentity Items   (STRUCT)                             // Interface Information
 *          Item Type Code   (UINT, 2 bytes, unsigned)            // Item Type Code
 *          Item Length      (UINT, 2 bytes, unsigned)            // Item Length
 *          Item Data        (ARRAY of octet, variable length)    // Item Data
 */

// A STRUCT ListIdentity é composta obrigatoriamente de pelo menos um array com o item CIP Identity, que é onde consta as informações de identidade do dispositivo
/**
 * IdentityItem
 *      Item Type Code               (UINT, 2 bytes, unsigned)            // Code indicating item type of CIP Identity (0x0C)
 *      Item Length                  (UINT, 2 bytes, unsigned)            // Number of bytes in item which follow
 *      Encapsulation Protocol Version (UINT, 2 bytes, unsigned)          // Encapsulation Protocol Version supported
 *      Socket Address               (STRUCT)                             // Socket Address
 *          sin_family               (INT, 2 bytes, big-endian)           // Address family (big-endian)
 *          sin_port                 (UINT, 2 bytes, big-endian)          // Port number (big-endian)
 *          sin_addr                 (UDINT, 4 bytes, big-endian)         // IP address (big-endian)
 *          sin_zero                 (ARRAY[8] of USINT, 8 bytes)         // Padding zeros
 *      Vendor ID1                   (UINT, 2 bytes, unsigned)            // Device manufacturer's Vendor ID
 *      Device Type1                 (UINT, 2 bytes, unsigned)            // Device Type of product
 *      Product Code1                (UINT, 2 bytes, unsigned)            // Product Code assigned with respect to device type
 *      Revision1                    (USINT[2], 2 bytes, unsigned)        // Device revision
 *      Status1                      (WORD, 2 bytes, unsigned)            // Current status of device
 *      Serial Number1               (UDINT, 4 bytes, unsigned)           // Serial number of device
 *      Product Name1                (SHORT_STRING, variable length)      // Human-readable description of device
 *      State1                       (USINT, 1 byte, unsigned)            // Current state of device
 */

/**
 * Informações de uma identidade CIP do dispositivo
 * @typedef IdentidadeCIP
 * @property {Number} tipo - Tipo da identidade (codigo decimal)
 * @property {Number} versao_protocolo_encapsulamento - Versão do protocolo de encapsulamento EtherNet/IP do dispositivo(sempre deve ser 1 segundo o manuel '-')
 * @property {Object} endereco_socket - Endereço do socket do dispositivo
 * @property {Number} endereco_socket.familia - Família do endereço do socket
 * @property {Number} endereco_socket.porta - Porta do endereço do socket
 * @property {String} endereco_socket.endereco - Endereço IP do socket
 * @property {String} endereco_socket.zeros - Zeros do endereço do socket
 * @property {Number} fabricante_id - ID do fabricante do dispositivo (decimal)
 * @property {Number} tipo_dispositivo - Tipo do dispositivo (decimal)
 * @property {Number} codigo_produto - Código do produto (decimal)
 * @property {String} versao_revisao - Versão de revisão do dispositivo
 * @property {Number} status_dispositivo - Status do dispositivo (decimal)
 * @property {Number} numero_serial - Número serial do dispositivo
 * @property {Number} tamanho_nome_dispositivo - Tamanho do nome do dispositivo
 * @property {String} nome_dispositivo - Nome do dispositivo
 * @property {Number} estado_dispositivo - Estado do dispositivo
 */

/**
 * 
 */
export class CommandSpecificDataListIdentity {

    /**
     * Status se os campos pra compor o ListIdentity é valido
     */
    #statusComando = {
        isValido: false,
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
     * Campos que existem no ListIdentity
     */
    #campos = {
        /**
         * Total de identidades retornadas(geralmente é só 1 que é o CIP Identity)
         */
        contadorTotIdentidades: undefined,
        /**
         * Identidade CIP do dispositivo
         * @type {IdentidadeCIP}
         */
        identidadeCIP: undefined
    }

    /**
     * Instanciar o payload do comando de List Identity
     * @param {Buffer} buffer - Opcionamente um buffer para dar parse
     */
    constructor(buff) {
        if (buff != undefined) this.parseBuffer(buff);
        return this;
    }

    /**
     * Retorna se o parser do Buffer foi validado com sucesso.
     */
    isValido() {
        const isValido = {
            /**
             * Se o parser do buffer foi validado com sucesso
             */
            isValido: false,
            /**
             * Detalhes do erro de validação do parser se houve algum
             */
            erro: {
                descricao: ''
            },
            /**
             * O tracer contém detalhes do passo a passo do parser do buffer
             * @type {TraceLog}
             */
            tracer: undefined
        }

        isValido.tracer = this.#statusComando.tracer;

        if (this.#statusComando.isValido) {
            isValido.isValido = true;
        } else {
            isValido.erro.descricao = this.#statusComando.erro.descricao;
        }
        return isValido;
    }

    /**
     * Passar um Buffer de Command Specific Data do tipo ListIdentity e fazer o parse dos campos
     * @param {Buffer} buff - Buffer com os dados do Command Specific Data
     */
    parseBuffer(buff) {
        const retornoParse = {
            isSucesso: false,
            erro: {
                descricao: ''
            },
            /**
             * Detalhes do parse do buffer recebido
             */
            tracer: new TraceLog()
        }

        const tracerBuffer = retornoParse.tracer.addTipo('ListIdentity Parser')
        this.#statusComando.tracer = retornoParse.tracer;

        tracerBuffer.add(`Iniciando o parser de ListIdentity para o Buffer: ${hexDeBuffer(buff)}, com ${buff.length} bytes.`);

        // Se o buffer não tiver pelo menos 2 bytes do tamanho da lista de identidades retornadas, ele não é um buffer válido
        if (buff.length < 2) {
            this.#statusComando.isValido = false
            this.#statusComando.erro.descricao = 'Buffer não contém os 2 bytes minimos do Command Specific Data do comando List Identity.';

            retornoParse.erro.descricao = this.#statusComando.erro.descricao;

            tracerBuffer.add(`O Buffer informado não contém os 2 bytes minimos do Command Specific Data do comando List Identity.`);
            return retornoParse;
        }

        // Total de identidades recebidas
        let totIdentidades = buff.readUInt16LE(0);
        tracerBuffer.add(`Lendo o total de identidades retornadas: ${totIdentidades}: (${numeroToHex(totIdentidades, 2)})`);

        let offsetBuff = 0;

        for (let identidadeIndex = 0; identidadeIndex < totIdentidades; identidadeIndex++) {

            // Verificar se o Buffer tem o range do proximo tipo de identidade
            if (buff.length < offsetBuff + 4) {
                this.#statusComando.isValido = false;
                this.#statusComando.erro.descricao = `Buffer não tem o range de bytes suficiente pra ler a identidade ${identidadeIndex + 1}. Esperado no minimo ${offsetBuff + 4} bytes, atual ${buff.length} bytes`;

                retornoParse.erro.descricao = this.#statusComando.erro.descricao;

                tracerBuffer.add(`Buffer não tem o range de bytes suficiente pra ler a identidade ${identidadeIndex + 1}. Esperado no minimo ${offsetBuff + 4} bytes, atual ${buff.length} bytes`);
                return retornoParse;
            }

            // Os próximos 2 bytes é tipo da identidade
            const tipoIdentidade = buff.readUInt16LE(offsetBuff + 2);
            tracerBuffer.add(`Lendo o tipo da identidade: ${tipoIdentidade}: (${numeroToHex(tipoIdentidade, 2)}) do offset ${offsetBuff + 2}`);

            switch (tipoIdentidade) {

                // ID da Identidade CIP
                case 0x000c: {

                    // Os próximos 2 bytes é o tamanho em bytes do payload total dessa identidade que é composto por
                    //* Encapsulation Protocol Version: 2 bytes
                    //* Socket Address: 16 bytes
                    //* Vendor ID: 2 bytes
                    //* Device Type: 2 bytes
                    //* Product Code: 2 bytes
                    //* Revision: 2 bytes
                    //* Status: 2 bytes
                    //* Serial Number: 4 bytes
                    //* Product Name Length: 1 byte
                    //* Product Name: (equivalente ao Product Name Length)
                    //* State: 1 byte
                    const tamanhoPayloadBytes = buff.readUInt16LE(offsetBuff + 4);

                    let offsetInicioIdCIP = offsetBuff + 6;
                    let offsetFimIdCIP = offsetBuff + 6 + tamanhoPayloadBytes;

                    // Passar o Buffer cortado com a identidade CIP para o método de parse
                    let identidadeCIPDados = parseIdentidadeCIP(buff.subarray(offsetInicioIdCIP, offsetFimIdCIP));

                    tracerBuffer.add(`Lendo o payload da identidade CIP: ${hexDeBuffer(buff.subarray(offsetInicioIdCIP, offsetFimIdCIP))} do offset ${offsetInicioIdCIP} até ${offsetFimIdCIP}`);

                    // Se conseguiu extrair com sucesso as informações do CIP, salvar ele
                    if (identidadeCIPDados.isSucesso) {
                        this.#campos.identidadeCIP = identidadeCIPDados.sucesso.cipIdentidade;

                        // Mover o offset para a próxima identidade disponivel. Sendo o offset do payload do Identity CIP + 2 byte do tamanho do payload do Identity CIP) + 2 byte do tipo da identidade CIP);
                        offsetBuff += tamanhoPayloadBytes + 2 + 2;

                        tracerBuffer.add(`Identidade CIP extraida com sucesso. ${JSON.stringify(this.#campos.identidadeCIP)}`);
                        break;
                    } else {

                        // Se deu erros, eu não devo continuar verificando os outros bytes pois não vou ter a ordem certa dos bytes
                        this.#statusComando.isValido = false;
                        this.#statusComando.erro.descricao = `Erro ao dar parse na Identidade CIP: ${identidadeCIPDados.erro.descricao}`;

                        retornoParse.erro.descricao = `Erro ao dar parse na Identidade CIP: ${identidadeCIPDados.erro.descricao}`;

                        tracerBuffer.add(`Erro ao dar parse na Identidade CIP: ${identidadeCIPDados.erro.descricao}`);
                        return retornoParse;
                    }
                }
                default: {
                    tracerBuffer.add(`Tipo de identidade não reconhecido: ${tipoIdentidade}: (${numeroToHex(tipoIdentidade, 2)}) do offset ${offsetBuff + 2}`);
                    break;
                }
            }
        }

        // Após validar as identidades disponiveis, finalizar o parse
        this.#statusComando.isValido = true;
        this.#campos.contadorTotIdentidades = totIdentidades;

        tracerBuffer.add(`Finalizando o parser de ListIdentity com sucesso!`);

        retornoParse.isSucesso = true;
        return retornoParse;
    }

    /**
     * Retorna o total de identidades retornadas
     */
    getTotalIdentidades() {
        return this.#campos.contadorTotIdentidades;
    }

    /**
     * Retorna a identidade CIP do dispositivo
     */
    getIdentidadeCIP() {
        return this.#campos.identidadeCIP;
    }
}

/**
 * Extrair as informações do objeto Identidade CIP de um buffer
 * @param {Buffer} buffCIP - Buffer com as informações do CIP Identity
 */
export function parseIdentidadeCIP(buffCIP) {
    let retornoParse = {
        isSucesso: false,
        sucesso: {
            cipIdentidade: undefined
        },
        erro: {
            descricao: ''
        }
    }

    const extrairEnderecoIp = (buffer) => {
        const octeto1 = (buffer >> 24) & 0xFF;
        const octeto2 = (buffer >> 16) & 0xFF;
        const octeto3 = (buffer >> 8) & 0xFF;
        const octeto4 = buffer & 0xFF;

        return `${octeto1}.${octeto2}.${octeto3}.${octeto4}`;
    }

    const extrairEnderecoZeros =
        /**
         * 
         * @param {Buffer} buffer 
         */
        (buffer) => {

            let padding = '';

            // Ler os valores de USINT (1 byte cada)
            for (let i = 0; i < 8; i++) {
                const usintValue = buffer.readUInt8(i);  // Lê 1 byte de cada vez
                padding += `${usintValue}`
            }

            return padding;
        }

    // O buffer precisa ter no minimo 33 bytes para conter as informações do CIP Identity
    if (buffCIP.length < 33) {
        retornoParse.erro.descricao = 'Buffer não contém os 33 bytes minimos para conter as informações do CIP Identity';
        return retornoParse
    }

    let versaoEncapsulamento;
    let enderecoSocket = {}
    let fabricanteId;
    let tipoDispositivo;
    let codigoProduto;
    let versaoRevisao;
    let statusDispositivo;
    let numeroSerial;
    let tamanhoNomeDispositivo;
    let nomeDispositivo;
    let estadoDispositivo;

    // Os próximos 2 bytes é a versão do protocolo de encapsulamento (geralmente sempre 1)
    try {
        versaoEncapsulamento = buffCIP.readUInt16LE(0);
    } catch (ex) {
        if (ex instanceof RangeError) {
            retornoParse.erro.descricao = `Bytes da versão de encapsulamento não consta no range do Buffer de ${0} até ${offsetServicoAtual + 2}, o maximo atual é ${buff.length}`;
        } else {
            retornoParse.erro.descricao = `Erro desconhecido ao ler buffer dos bytes da versão de encapsulamento. ${ex.message}`;
        }

        return retornoParse;
    }

    // Os próximos 2 bytes é a familia do socket 
    try {
        enderecoSocket.familia = buffCIP.readInt16BE(2);
    } catch (ex) {
        if (ex instanceof RangeError) {
            retornoParse.erro.descricao = `Bytes da familia do socket não consta no range do Buffer de ${offsetServicoAtual + 2} até ${offsetServicoAtual + 4}, o maximo atual é ${buff.length}`;
        } else {
            retornoParse.erro.descricao = `Erro desconhecido ao ler buffer dos bytes da familia do socket. ${ex.message}`;
        }

        return retornoParse;
    }

    // Os próximos 2 bytes é a porta do socket
    try {
        enderecoSocket.porta = buffCIP.readUInt16BE(4);
    } catch (ex) {
        if (ex instanceof RangeError) {
            retornoParse.erro.descricao = `Bytes da porta do socket não consta no range do Buffer de ${offsetServicoAtual + 4} até ${offsetServicoAtual + 6}, o maximo atual é ${buff.length}`;
        } else {
            retornoParse.erro.descricao = `Erro desconhecido ao ler buffer dos bytes da porta do socket. ${ex.message}`;
        }
        return retornoParse;
    }

    // Os próximos 4 bytes é o endereço do socket
    try {
        enderecoSocket.endereco = extrairEnderecoIp(buffCIP.readUInt32BE(6));
    } catch (ex) {
        if (ex instanceof RangeError) {
            retornoParse.erro.descricao = `Bytes do endereço do socket não consta no range do Buffer de ${offsetServicoAtual + 6} até ${offsetServicoAtual + 10}, o maximo atual é ${buff.length}`;
        } else {
            retornoParse.erro.descricao = `Erro desconhecido ao ler buffer dos bytes do endereço do socket. ${ex.message}`;
        }

        return retornoParse
    }

    // Os próximos 8 bytes são os zeros do endereço do socket
    try {
        enderecoSocket.zeros = extrairEnderecoZeros(buffCIP.subarray(10, 10 + 8))
    } catch (ex) {
        if (ex instanceof RangeError) {
            retornoParse.erro.descricao = `Bytes dos zeros do endereço do socket não consta no range do Buffer de ${offsetServicoAtual + 10} até ${offsetServicoAtual + 18}, o maximo atual é ${buff.length}`;
        } else {
            retornoParse.erro.descricao = `Erro desconhecido ao ler buffer dos bytes dos zeros do endereço do socket. ${ex.message}`;
        }

        return retornoParse
    }

    // Os próximos 2 bytes são o Vendor ID
    try {
        fabricanteId = buffCIP.readUInt16LE(18);
    } catch (ex) {
        if (ex instanceof RangeError) {
            retornoParse.erro.descricao = `Bytes do Vendor ID não consta no range do Buffer de 18 até 20, o maximo atual é ${buffCIP.length}`;
        } else {
            retornoParse.erro.descricao = `Erro desconhecido ao ler buffer dos bytes do Vendor ID. ${ex.message}`;
        }

        return retornoParse;
    }

    // Os próximos 2 bytes são o Device Type
    try {
        tipoDispositivo = buffCIP.readUInt16LE(20);
    } catch (ex) {
        if (ex instanceof RangeError) {
            retornoParse.erro.descricao = `Bytes do Device Type não consta no range do Buffer de 20 até 22, o maximo atual é ${buffCIP.length}`;
        } else {
            retornoParse.erro.descricao = `Erro desconhecido ao ler buffer dos bytes do Device Type. ${ex.message}`;
        }
        return retornoParse;
    }

    // Os próximos 2 bytes são o Product Code
    try {
        codigoProduto = buffCIP.readUInt16LE(22);
    } catch (ex) {
        if (ex instanceof RangeError) {
            retornoParse.erro.descricao = `Bytes do Product Code não consta no range do Buffer de 22 até 24, o maximo atual é ${buffCIP.length}`;
        } else {
            retornoParse.erro.descricao = `Erro desconhecido ao ler buffer dos bytes do Product Code. ${ex.message}`;
        }
        return retornoParse;
    }

    // Os próximos 2 bytes são o Revision
    try {
        versaoRevisao = buffCIP.subarray(24, 24 + 2).join('.');
    } catch (ex) {
        if (ex instanceof RangeError) {
            retornoParse.erro.descricao = `Bytes do Revision não consta no range do Buffer de 24 até 26, o maximo atual é ${buffCIP.length}`;
        } else {
            retornoParse.erro.descricao = `Erro desconhecido ao ler buffer dos bytes do Revision. ${ex.message}`;
        }
        return retornoParse;
    }

    // Os próximos 2 bytes são o Status
    try {
        statusDispositivo = buffCIP.readUInt16LE(26);
    } catch (ex) {
        if (ex instanceof RangeError) {
            retornoParse.erro.descricao = `Bytes do Status não consta no range do Buffer de 26 até 28, o maximo atual é ${buffCIP.length}`;
        } else {
            retornoParse.erro.descricao = `Erro desconhecido ao ler buffer dos bytes do Status. ${ex.message}`;
        }
        return retornoParse;
    }

    // Os próximos 4 bytes são o Serial Number
    try {
        numeroSerial = buffCIP.readUInt32LE(28);
    } catch (ex) {
        if (ex instanceof RangeError) {
            retornoParse.erro.descricao = `Bytes do Serial Number não consta no range do Buffer de 28 até 32, o maximo atual é ${buffCIP.length}`;
        } else {
            retornoParse.erro.descricao = `Erro desconhecido ao ler buffer dos bytes do Serial Number. ${ex.message}`;
        }
        return retornoParse;
    }

    // Os próximos 1 byte é o tamanho do nome do produto
    try {
        tamanhoNomeDispositivo = buffCIP.readUInt8(32);
    } catch (ex) {
        if (ex instanceof RangeError) {
            retornoParse.erro.descricao = `Bytes do tamanho do nome do produto não consta no range do Buffer de 32 até 33, o maximo atual é ${buffCIP.length}`;
        } else {
            retornoParse.erro.descricao = `Erro desconhecido ao ler buffer dos bytes do tamanho do nome do produto. ${ex.message}`;
        }
        return retornoParse;
    }

    // O nome do produto é o próximo byte até o tamanho do nome do produto
    try {
        nomeDispositivo = buffCIP.toString('ascii', 33, 33 + tamanhoNomeDispositivo);
    } catch (ex) {
        if (ex instanceof RangeError) {
            retornoParse.erro.descricao = `Bytes do nome do produto não consta no range do Buffer de 33 até ${33 + tamanhoNomeDispositivo}, o maximo atual é ${buffCIP.length}`;
        } else {
            retornoParse.erro.descricao = `Erro desconhecido ao ler buffer dos bytes do nome do produto. ${ex.message}`;
        }
        return retornoParse;
    }

    // O próximo byte é o estado do dispositivo
    try {
        estadoDispositivo = buffCIP.readUInt8(33 + tamanhoNomeDispositivo);
    } catch (ex) {
        if (ex instanceof RangeError) {
            retornoParse.erro.descricao = `Bytes do estado do dispositivo não consta no range do Buffer de ${33 + tamanhoNomeDispositivo} até ${33 + tamanhoNomeDispositivo + 1}, o maximo atual é ${buffCIP.length}`;
        } else {
            retornoParse.erro.descricao = `Erro desconhecido ao ler buffer dos bytes do estado do dispositivo. ${ex.message}`;
        }
        return retornoParse;
    }

    /**
     * @type {IdentidadeCIP}
     */
    const identCip = {
        tipo: 0x000c,
        versao_protocolo_encapsulamento: versaoEncapsulamento,
        endereco_socket: {
            endereco: enderecoSocket.endereco,
            familia: enderecoSocket.familia,
            porta: enderecoSocket.porta,
            zeros: enderecoSocket.zeros
        },
        fabricante_id: fabricanteId,
        tipo_dispositivo: tipoDispositivo,
        codigo_produto: codigoProduto,
        versao_revisao: versaoRevisao,
        status_dispositivo: statusDispositivo,
        numero_serial: numeroSerial,
        tamanho_nome_dispositivo: tamanhoNomeDispositivo,
        nome_dispositivo: nomeDispositivo,
        estado_dispositivo: estadoDispositivo
    }

    retornoParse.isSucesso = true;
    retornoParse.sucesso.cipIdentidade = identCip;

    return retornoParse;
}