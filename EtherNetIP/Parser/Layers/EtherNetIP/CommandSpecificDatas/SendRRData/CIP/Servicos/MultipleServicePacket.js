/**
 * 
 */

import { CIPGeneralStatusCodes, getStatusCode } from "../../../../../../../Utils/CIPRespondeCodes.js";
import { CIPSendRRDataParser } from "../CIPParser.js";

/**
 * O Parser do Multiple Service Packet contém todos os serviços solicitados em uma solicitação CIP
 */
export class MultipleServicePacketParser {

    /**
     * Status atual do parse do Multiple Service Packet
     ** Esse campo indica se os bytes recebidos são validos e encaixam com o que é esperado. Mensagens de buffers retornadas com erro devido ao mal uso da classe ainda são consideradas válidas. Esse campo apenas indica se
     houver algum erro ao dar parse no buffer.
     */
    #statusMultipleService = {
        /**
         * Se o parse do Multiple Service Packet é valido ou não
         */
        isValido: false,
        /**
         * Descrição do erro encontrado no parse do Multiple Service Packet
         */
        erro: {
            descricao: ''
        }
    }

    #campos = {
        /**
         * Código de status do Multiple Service
         */
        codigoStatus: undefined,
        /**
         * Lista de serviços parseados no Multiple Service Packet
         * @type {CIPSendRRDataParser[]}
         */
        servicesPacketsParseados: []
    }

    /**
     * Instanciar o construtor
     * @param {Buffer} buff - Opcionalmente, passar um buffer no construtor pra aplicar o parse ao Multiple Service Packet
     */
    constructor(buff) {
        if (buff != undefined) this.parseBuffer(buff);
    }

    /**
     * Retorna todos os services packets contidos nesse MultipleServicePacket
     */
    getServicesPackets() {
        return this.#campos.servicesPacketsParseados;
    }

    /**
     * Passar um Buffer compativél com o Multiple Service Packet para dar parse
     * @param {Buffer} buff - Buffer cortado com os dados do Multiple Service Packet
     */
    parseBuffer(buff) {
        const retBuff = {
            isSucesso: false,
            erro: {
                descricao: ''
            }
        }

        // Verificar se não foi informado um Buffer que não corresponde ao necessario pra obter as informações dos serviços contidos no pacote
        if (buff.length < 4) {
            this.#statusMultipleService.isValido = false;
            this.#statusMultipleService.erro.descricao = 'O buffer Multiple Service Packet informado não contém os 4 bytes minimos que informam o código de status e quantidade de serviços.';

            retBuff.erro.descricao = this.#statusMultipleService.erro.descricao;
            return retBuff;
        }

        // Primeiro 1 bytes é o codigo de status geral do Multiple Service Packet. Os serviços inclusos podem ter ocorrido algum erro.
        this.#campos.codigoStatus = buff.readUInt8(0);

        // Os próximos 2 bytes são a quantidade de serviços recebidos no pacote
        const quantidadeServicos = buff.readUInt16LE(2);

        // Se o buffer for menor que a quantidade aonde consta o ultimo offset dos offset dos serviços, é pq ta faltando algo
        if (buff.length < 4 + (quantidadeServicos * 2) + 2) {
            this.#statusMultipleService.isValido = false;
            this.#statusMultipleService.erro.descricao = `O buffer Multiple Service Packet contém apenas ${buff.length}, mas era esperado pelo menos ${4 + (quantidadeServicos * 2) + 2} bytes que contem as informações basicas dos serviços contidos na solicitação.`;

            retBuff.erro.descricao = this.#statusMultipleService.erro.descricao;
            return retBuff;

        }

        // O array de offsets indica a partir de qual offset do buffer cada serviço recebido na resposta começa
        // Começa dos 4 bytes em diante + até a quantidade de serviço * 2, pois cada serviço tem 2 bytes indicando onde o offset começa
        const bufferOffsetsServicos = buff.subarray(4, 4 + (quantidadeServicos * 2));

        /**
         * @typedef OffsetServices
         * @property {Number} serviceNumero - Numero do serviço
         * @property {Number} offset - Offset do buffer onde começa o serviço
         * @property {Buffer} bufferService - Buffer do serviço cortado
         */

        /**
         * @type {OffsetServices[]}
         */
        const offsetServices = []

        // Eu vou encontrar a posição do buffer primeiro dos offsets
        for (let offsetServiceIndex = 0; offsetServiceIndex < bufferOffsetsServicos.length; offsetServiceIndex += 2) {

            let numeroOffset = bufferOffsetsServicos.readUInt16LE(offsetServiceIndex);
            offsetServices.push({
                serviceNumero: offsetServices.length + 1,
                offset: numeroOffset
            })
        }

        // Se o buffer não contém os Services Packet logo após os offsets de cada service, é pq ta faltando informações no pacote
        if (buff.length < 4 + bufferOffsetsServicos.length) {
            this.#statusMultipleService.isValido = false;
            this.#statusMultipleService.erro.descricao = `O buffer Multiple Service Packet não contém os bytes suficientes para os serviços contidos na solicitação, o buffer recebido contém ${buff.length} bytes, mas era esperado pelo menos ${4 + bufferOffsetsServicos.length} bytes.`;

            retBuff.erro.descricao = this.#statusMultipleService.erro.descricao;
            return retBuff;
        }

        // O buffer de service packets contem os buffers de cada serviço recebido na resposta.
        const bufferServicePackets = buff.subarray(4 + bufferOffsetsServicos.length);

        let offsetServiceInicio = 0;
        // Ok, agora que coletei as posições dos servicos no Buffer, vou cortar os pedacinhos dos serviços e armazenar eles
        for (let serviceIndex = 0; serviceIndex < offsetServices.length; serviceIndex++) {

            const offsetServiceAtual = offsetServices[serviceIndex];
            let offsetServiceFim = 0;

            // Pra eu saber até onde os bytes do serviço vai, eu verifico se tem o proximo, se sim, o offset vai até esse valor
            if (serviceIndex + 1 < offsetServices.length) {
                // Se tiver o próximo serviço, eu uso ele pra saber aonde o offset acaba
                offsetServiceFim = offsetServiceInicio + (offsetServices[serviceIndex + 1].offset - offsetServiceAtual.offset);
            } else {
                // Se for o último serviço, eu vou até o final do buffer
                offsetServiceFim = bufferServicePackets.length;
            }

            // Se o Buffer não tem os bytes necessario desse serviço atual, eu não posso continuar
            if (bufferServicePackets.length < offsetServiceFim) {
                this.#statusMultipleService.isValido = false;
                this.#statusMultipleService.erro.descricao = `O serviço id #${offsetServiceAtual.serviceNumero} não contém os bytes suficientes no Buffer de Service Packets. Esperado os bytes de ${offsetServiceInicio} até ${offsetServiceFim}, porém o Buffer vai somente até ${bufferServicePacket.length} bytes.`;

                retBuff.erro.descricao = this.#statusMultipleService.erro.descricao;
                return retBuff;
            }

            const bufferServicePacket = bufferServicePackets.subarray(offsetServiceInicio, offsetServiceFim);

            // Armazenar o buffer do Packet
            offsetServiceAtual.bufferService = bufferServicePacket;

            // Salvar o offset de inicio a partir do atual
            offsetServiceInicio = offsetServiceFim;
        }

        let novosServicosCIP = []

        // Após efetuar toda a validação, eu tenho em mãos todos os Buffers dos serviços enviados pelo dispositivo.
        for (const serviceDados of offsetServices) {

            // O Parser do CIP é responsável por dar parse no buffer do serviço que esta encapsulado no formato CIP
            const construirBufferCIP = new CIPSendRRDataParser();
            const retornoParser = construirBufferCIP.parseBuffer(serviceDados.bufferService);

            if (!retornoParser.isSucesso) {
                this.#statusMultipleService.isValido = false;
                this.#statusMultipleService.erro.descricao = `Erro ao dar parse no serviço ID #${serviceDados.serviceNumero} (offset ${serviceDados.offset}): ${retornoParser.erro.descricao}`;

                retBuff.erro.descricao = this.#statusMultipleService.erro.descricao;
                return retBuff;
            }

            // Adicionar os serviços parseados na lista de serviços
            novosServicosCIP.push(construirBufferCIP);
        }

        // Se tudo estiver correto, confirmar que é valido
        this.#statusMultipleService.isValido = true;
        this.#statusMultipleService.erro.descricao = '';

        this.#campos.servicesPacketsParseados = novosServicosCIP;

        retBuff.isSucesso = true;
        return retBuff;
    }

    /**
     * Retorna se esse MultipleServicePacket é valido, ou seja todos os campos foram corretamente parseados do Buffer.
     */
    isValido() {
        const retValido = {
            isValido: false,
            erro: {
                descricao: ''
            }
        }

        if (this.#statusMultipleService.isValido) {
            retValido.isValido = true
        } else {
            retValido.erro.descricao = this.#statusMultipleService.erro.descricao;
        }

        return retValido;
    }

    /**
     * Retorna o status de esse MultipleServicePacket obteve sucesso na sua solicitação
     ** Lembre-se de validar se o comando é valido antes de chamar esse método
     */
    isStatusSucesso() {
        let retSucesso = {
            /**
             * Retorna se esse Service foi executado com sucesso
             */
            isSucesso: false,
            erro: {
                descricao: '',
                codigoStatus: '',
                descricaoStatus: ''
            }
        }

        const statusAtual = this.getStatus();
        if (statusAtual.codigoStatus == CIPGeneralStatusCodes.Success) {
            retSucesso.isSucesso = true;
        } else {
            retSucesso.erro.descricao = `O status do serviço solicitado não foi bem sucedido. Código de status: ${statusAtual.codigoStatus} - ${statusAtual.descricaoStatus}`;

            retSucesso.erro.codigoStatus = statusAtual.codigoStatus;
            retSucesso.erro.descricaoStatus = statusAtual.descricaoStatus;
        }

        return retSucesso;
    }

    /**
     * Retorna o status atual ocorrido nesse serviço solicitado.
     */
    getStatus() {
        let retornoCodigo = {
            /**
             * Código de status do serviço solicitado
             */
            codigoStatus: this.#campos.codigoStatus,
            /**
             * Descrição do código de status do serviço solicitado
             */
            descricaoStatus: ''
        }

        let status = getStatusCode(this.#campos.codigoStatus);
        if (status != undefined) {
            retornoCodigo.descricaoStatus = status.descricao;
        } else {
            retornoCodigo.descricaoStatus = `Código de status do Single Service Packet recebido: '${this.#campos.codigoStatus}' não é um código de status válido. `;
        }

        return retornoCodigo;
    }
}