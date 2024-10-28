/**
 * O Multiple Service Packet permite enviar varios serviços em um unico pacote para receber de uma vez a resposta
 * Ele segue o seguinte padrão:
 * Primeiros 2 bytes: Numero de services solicitados
 * Próximos x bytes: Offset list, onde cada serviço adicionado é um offset de 2 bytes indicando qual o offset no buffer onde começa o serviço no buffer
 * Próximos x bytes: Para cada serviço, adicionar primeiro o campo de 2 bytes indicado Offset(que foi referenciado na offset list), seguido pelo buffer SingleServicePacket(que inclui o layer CIP)
 */

/**
 * Segue exemplo abaixo do Wireshark:
 * 
 * Multiple Service Packet (Request)
    Number of Services: 3 (2 bytes)
    Offset List
        Offset: 8 (2 bytes)
        Offset: 32 (2 bytes)
        Offset: 44 (2 bytes)
    Service Packet #1: 'BD_D1_MOTIVO_DIA1' - Service (0x4c)
        Offset: 8 (isso aqui nao vai no buffer, o Wireshark adiciona pra saber qual offset é)
        Common Industrial Protocol
            Service: Unknown Service (0x4c) (Request)
                0... .... = Request/Response: Request (0x0)
                .100 1100 = Service: Unknown (0x4c)
            Request Path Size: 10 words
            Request Path: BD_D1_MOTIVO_DIA1
        CIP Class Generic
    Service Packet #2: 'TESTE' - Service (0x4c)
        Offset: 32
        Common Industrial Protocol
            Service: Unknown Service (0x4c) (Request)
            Request Path Size: 4 words
            Request Path: TESTE
        CIP Class Generic
    Service Packet #3: 'TESTE2' - Service (0x4c)
        Offset: 44
        Common Industrial Protocol
            Service: Unknown Service (0x4c) (Request)
            Request Path Size: 4 words
            Request Path: TESTE2
        CIP Class Generic

 */

import { SingleServicePacketServiceBuilder } from "../SingleServicePacket/SingleServicePacket.js";

/**
 * @typedef SingleServicePacket
 * @property {Number} id - Apenas um ID inteiro pra identificar esse service packet
 * @property {SingleServicePacketServiceBuilder} servico - O Serviço Builder para customizar o que vai ser solicitado
 */

/**
 * O Multiple Service Packet (0x0a) é usado para solicitar varios servicos em um unico pacote
 */
export class MultipleServicePacketServiceBuilder {

    /**
     * Código do serviço do Multiple Service Packet
     */
    codigoServico = 0x0a;

    /**
     * Os campos inclusos no serviço Multiple Service Packet
     */
    #campos = {
        /**
         * Informações do Requesth Path pra enviar no Multiple Service Packet 
         */
        requestPath: {
            /**
             * Classe, ex: 0x20
             * @type {Buffer}
             */
            classe: undefined,
            /**
             * Instanciad a classe, ex: 0x01
             * @type {Buffer}
             */
            instancia: undefined
        },
        /**
         * Lista de serviços que vão ser solicitados no Multiple Service Packet
         * @type {SingleServicePacket[]}
         */
        servicesPackets: []
    }

    /**
     * Instanciar o construtor Multiple Service Packet
     */
    constructor() {
        return this;
    }

    /**
     * Criar o Buffer Multipel Service Packet 
     */
    criarBuffer() {
        const retBuff = {
            isSucesso: false,
            sucesso: {
                /**
                 * O Buffer com os dados do Single Service Packet
                 * @type {Buffer}
                 */
                buffer: undefined
            },
            erro: {
                descricao: ''
            }
        }

        // O buffer de cabeçalho são 6 bytes pro serviço Multiple Service Packet
        const bufferCabecalho = Buffer.alloc(6);

        // 1 Byte é código do serviço(Nesse caso MultipleServicePacket)
        bufferCabecalho.writeUInt8(this.codigoServico, 0);

        // 1 Byte pro Request Path Size em WORDs
        bufferCabecalho.writeUInt8(Math.ceil((this.#campos.requestPath.classe.length + this.#campos.requestPath.instancia.length) / 2), 1);

        // Próximos 4 bytes definem a classe e instancia pro MessageRouter provavelmente
        // 2 bytes pra Classe
        this.#campos.requestPath.classe.copy(bufferCabecalho, 2);

        // 2 bytes pra Instancia
        this.#campos.requestPath.instancia.copy(bufferCabecalho, 4);

        // ---------------------
        // Criar um buffer onde vou adicionar o corpo do payload MultipleServicePacket, que é a lista de serviços que vão ser solicitadas ao servidor
        // Esse buffer só armazena inicialmente o total de itens + o offset de cada serviço localizado no Buffer
        const bufferCorpoServices = Buffer.alloc(2 + (this.#campos.servicesPackets.length * 2));

        // Escreve os primeiros 2 bytes da lista de serviços existentes
        bufferCorpoServices.writeUInt16LE(this.#campos.servicesPackets.length, 0);

        /**
         * @typedef BufferServicePacket
         * @property {SingleServicePacket} servicePacket - Instancia do serviço packet
         * @property {Buffer} buff - Buffer gerado pro serviço
         */

        /**
         * Armazena os buffers gerados de cada serviço
         * @type {BufferServicePacket[]}
         */
        const bufferServicesPackets = []

        /**
         * Iterar sobre cada serviço solicitado e preparar o buffer com eles
         */
        for (const servicoPacket of this.#campos.servicesPackets) {

            // Solicitar a geração do Buffer desse Single Service Packet
            const gerarBuffer = servicoPacket.servico.criarBuffer();

            // Se ocorreu algum erro na geração do Buffer, retornar o erro
            if (!gerarBuffer.isSucesso) {
                retBuff.erro.descricao = `[MultipleServicePacketService] Erro ao gerar o buffer do Single Service Packet ID ${servicoPacket.id} (${servicoPacket.servico.getStringPath()}): ${gerarBuffer.erro.descricao}`;

                return retBuff;
            }

            // Se gerou o buffer, adicionar ele na lista de packets
            bufferServicesPackets.push({
                servicePacket: servicoPacket,
                buff: gerarBuffer.sucesso.buffer
            });
        }

        // Ok, após a geração dos Buffers de cada service packets, vou passar por cada um pra adicionar os offsets no cabeçalho
        let offsetListIndexAtual = 2;

        // O offset de onde começa o primeiro byte do buffer de cada service packet.
        let offsetBufferAtual = 2 + (this.#campos.servicesPackets.length * 2);
        for (const buffServicePacketAdicionar of bufferServicesPackets) {

            // O tamanho do Buffer desse Single Service Packet
            const tamanhoBuffPacket = buffServicePacketAdicionar.buff.length;

            // Setar o offset de quando esse serviço inicia nos buffer
            bufferCorpoServices.writeUInt16LE(offsetBufferAtual, offsetListIndexAtual);

            // Pular 2 bytes pro próximo offset service
            offsetListIndexAtual += 2;

            // Pular 2 bytes do tamanho do Buffer do Service Packet anterior
            offsetBufferAtual += tamanhoBuffPacket;
        }

        // Após definir o cabeçalho com os offsets de cada service packet, criar o buffer final com o cabeçalho e os service packets
        const bufferCabecalhoServices = Buffer.concat([bufferCorpoServices, ...bufferServicesPackets.map((buff) => buff.buff)]);
        // ------------------------------

        retBuff.isSucesso = true;

        // Retornar o buffer final do Cabeçalho CIP do tipo do Evento + o payload do MultipleServicePacket
        retBuff.sucesso.buffer = Buffer.concat([bufferCabecalho, bufferCabecalhoServices]);

        return retBuff;
    }

    /**
     * Definir o Request Path onde a requisicao vai ser enviada	
     * @param {Buffer} classe - Classe do recurso a ser solicitado
     * @param {Buffer} instancia - Instancia da classe a ser solicitada
     */
    setRequestPath(classe, instancia) {
        if (classe == undefined && instancia == undefined) {
            throw new Error('Classe e Instancia do Request Path devem ser informados');
        }

        if (classe != undefined) {
            if (!(classe instanceof Buffer)) {
                throw new Error('Classe do Request Path deve ser um Buffer com o código da classe');
            }

            this.#campos.requestPath.classe = classe;
        }

        if (instancia != undefined) {
            if (!(instancia instanceof Buffer)) {
                throw new Error('Instancia do Request Path deve ser um Buffer com o código da instancia da classe');
            }

            this.#campos.requestPath.instancia = instancia;
        }

        return this;
    }

    /**
     * Adiciona um serviço Packet a lista de serviços que vão ser adicionados ao Multiple Service Packet e retorna ele para customizar.
     */
    addSingleServicePacket() {
        /**
         * @type {SingleServicePacket}
         */
        const novoSingleService = {
            id: this.#campos.servicesPackets.length,
            servico: new SingleServicePacketServiceBuilder()
        }

        this.#campos.servicesPackets.push(novoSingleService);

        return novoSingleService;
    }

    /**
     * Remove um serviço packet da lista de serviços adicionados ao Multiple Service Packet
     * @param {Number} id - O ID do serviço packet a ser removido
     */
    deleteSingleServicePacket(id) {
        this.#campos.servicesPackets = this.#campos.servicesPackets.filter((service) => service.id != id);

        return this;
    }

    /**
     * Retorna um serviço packet ID adicionado anteriormente pelo seu ID unico na lista
     * @param {Number} id 
     */
    getSingleServicePacket(id) {
        return this.#campos.servicesPackets.find((service) => service.id == id);
    }

    /**
     * Retorna a lista de serviços adicionados ao Multiple Service Packet
     */
    getServicesPackets() {
        return this.#campos.servicesPackets;
    }
}

