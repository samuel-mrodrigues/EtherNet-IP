
/**
 * Retorna uma string na representação hexadecimal de um buffer
 * @param {Buffer} buff 
 */
export function hexDeBuffer(buff) {
    return buff.toString('hex').match(/.{1,2}/g).join(' ')
}

/**
 * Substitui placeholders em um template com informações de uma data
 * @param {Date} date 
 * @param {string} template 
 * @returns {string}
 */
export function DateParaString(date, template = '') {
    const pad = (num, padDesejado = 2) => num.toString().padStart(padDesejado, '0');
    
    const replacements = {
        '%ano%': date.getFullYear(),
        '%mes%': pad(date.getMonth() + 1),
        '%dia%': pad(date.getDate()),
        '%hora%': pad(date.getHours()),
        '%minuto%': pad(date.getMinutes()),
        '%segundo%': pad(date.getSeconds()),
        '%milissegundo%': pad(date.getMilliseconds(), 3)
    };


    return template.replace(/%ano%|%mes%|%dia%|%hora%|%minuto%|%segundo%|%milissegundo%/g, match => replacements[match]);
}