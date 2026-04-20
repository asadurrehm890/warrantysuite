// app/utils/emailRenderer.js
import Handlebars from "handlebars";

// Simple template renderer that replaces {{variable}} placeholders
export function renderEmailTemplate(template, data) {
  try {
    // Use Handlebars for more robust templating
    const compiledHtml = Handlebars.compile(template.htmlContent);
    const compiledText = Handlebars.compile(template.textContent);
    const compiledSubject = Handlebars.compile(template.subject);
    
    return {
      subject: compiledSubject(data),
      htmlContent: compiledHtml(data),
      textContent: compiledText(data),
    };
  } catch (error) {
    console.error("Error rendering email template:", error);
    // Fallback to simple string replacement
    let subject = template.subject;
    let html = template.htmlContent;
    let text = template.textContent;
    
    Object.entries(data).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      subject = subject.replace(regex, value || "");
      html = html.replace(regex, value || "");
      text = text.replace(regex, value || "");
    });
    
    // Handle conditional blocks {{#if variable}}...{{/if}}
    const ifRegex = /{{#if (\w+)}}([\s\S]*?){{\/if}}/g;
    html = html.replace(ifRegex, (match, varName, content) => {
      return data[varName] ? content : "";
    });
    text = text.replace(ifRegex, (match, varName, content) => {
      return data[varName] ? content : "";
    });
    
    return { subject, htmlContent: html, textContent: text };
  }
}

// Get template from database or fallback to default
export async function getEmailTemplate(prisma, shop, type, defaultTemplate) {
  const template = await prisma.emailTemplate.findUnique({
    where: {
      shop_type: {
        shop,
        type,
      },
    },
  });
  
  if (template) {
    return template;
  }
  
  // Return default template structure
  return {
    subject: defaultTemplate.subject,
    htmlContent: defaultTemplate.htmlContent,
    textContent: defaultTemplate.textContent,
  };
}